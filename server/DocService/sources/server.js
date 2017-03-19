/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */

const cluster = require('cluster');
const configCommon = require('config');
const config = configCommon.get('services.CoAuthoring');

const logger = require('./../../Common/sources/logger');

if (cluster.isMaster) {
  const fs = require('fs');
  const co = require('co');
  const license = require('./../../Common/sources/license');
  var licenseInfo, workersCount = 0;
  const readLicense = function* () {
    licenseInfo = yield* license.readLicense();
    workersCount = Math.min(1, licenseInfo.count/*, Math.ceil(numCPUs * cfgWorkerPerCpu)*/);
  };
  const updateLicenseWorker = (worker) => {
    worker.send({data: licenseInfo});
  };
  const updateWorkers = () => {
    var i;
    const arrKeyWorkers = Object.keys(cluster.workers);
    if (arrKeyWorkers.length < workersCount) {
      for (i = arrKeyWorkers.length; i < workersCount; ++i) {
        const newWorker = cluster.fork();
        logger.warn('worker %s started.', newWorker.process.pid);
      }
    } else {
      for (i = workersCount; i < arrKeyWorkers.length; ++i) {
        const killWorker = cluster.workers[arrKeyWorkers[i]];
        if (killWorker) {
          killWorker.kill();
        }
      }
    }
  };
  const updateLicense = () => {
    return co(function*() {
      try {
        yield* readLicense();
        logger.warn('update cluster with %s workers', workersCount);
        for (var i in cluster.workers) {
          updateLicenseWorker(cluster.workers[i]);
        }
        updateWorkers();
      } catch (err) {
        logger.error('updateLicense error:\r\n%s', err.stack);
      }
    });
  };

  cluster.on('fork', (worker) => {
    updateLicenseWorker(worker);
  });
  cluster.on('exit', (worker) => {
    logger.warn('worker %s died.', worker.process.pid);
    updateWorkers();
  });

  updateLicense();

  fs.watchFile(configCommon.get('license').get('license_file'), updateLicense);
  setInterval(updateLicense, 86400000);
} else {
  const express = require('express');
  const http = require('http');
  const urlModule = require('url');
  const path = require('path');
  const bodyParser = require("body-parser");
  const mime = require('mime');
  const forwarded = require('forwarded');
  const docsCoServer = require('./DocsCoServer');
  const canvasService = require('./canvasservice');
  const converterService = require('./converterservice');
  const fontService = require('./fontservice');
  const fileUploaderService = require('./fileuploaderservice');
  const constants = require('./../../Common/sources/constants');
  const utils = require('./../../Common/sources/utils');
  const configStorage = configCommon.get('storage');
  var configIpFilter = configCommon.get('services.CoAuthoring.ipfilter');
  var cfgIpFilterEseForRequest = configIpFilter.get('useforrequest');
  const app = express();
  var server = null;

  logger.warn('Express server starting...');

  server = http.createServer(app);

  if (config.has('server.static_content')) {
    var staticContent = config.get('server.static_content');
    for (var i = 0; i < staticContent.length; ++i) {
      var staticContentElem = staticContent[i];
      app.use(staticContentElem['name'], express.static(staticContentElem['path'], staticContentElem['options']));
    }
  }

  if (configStorage.has('fs.folderPath')) {
    var cfgBucketName = configStorage.get('bucketName');
    var cfgStorageFolderName = configStorage.get('storageFolderName');
    app.use('/' + cfgBucketName + '/' + cfgStorageFolderName, (req, res, next) => {
      var index = req.url.lastIndexOf('/');
      if ('GET' === req.method && -1 != index) {
        var contentDisposition = req.query['disposition'] || 'attachment';
        var sendFileOptions = {
          root: configStorage.get('fs.folderPath'),
          dotfiles: 'deny',
          headers: {
            'Content-Disposition': contentDisposition
          }
        };
        var urlParsed = urlModule.parse(req.url);
        if (urlParsed && urlParsed.pathname) {
          var filename = decodeURIComponent(path.basename(urlParsed.pathname));
          sendFileOptions.headers['Content-Type'] = mime.lookup(filename);
        }
        var realUrl = req.url.substring(0, index);
        res.sendFile(realUrl, sendFileOptions, (err) => {
          if (err) {
            logger.error(err);
            res.status(400).end();
          }
        });
      } else {
        res.sendStatus(404)
      }
    });
  }
  function checkClientIp(req, res, next) {
    var status = 0;
    if (cfgIpFilterEseForRequest) {
      var addresses = forwarded(req);
      var ipString = addresses[addresses.length - 1];
      status = utils.checkIpFilter(ipString);
    }
    if (status > 0) {
      res.sendStatus(status);
    } else {
      next();
    }
  }
  docsCoServer.install(server, () => {
    server.listen(config.get('server.port'), () => {
      logger.warn("Express server listening on port %d in %s mode", config.get('server.port'), app.settings.env);
    });

    app.get('/index.html', (req, res) => {
      res.send('Server is functioning normally. Version: ' + docsCoServer.version);
    });
    var rawFileParser = bodyParser.raw({ inflate: true, limit: config.get('server.limits_tempfile_upload'), type: '*/*' });

    app.get('/coauthoring/CommandService.ashx', checkClientIp, rawFileParser, docsCoServer.commandFromServer);
    app.post('/coauthoring/CommandService.ashx', checkClientIp, rawFileParser, docsCoServer.commandFromServer);

    if (config.has('server.fonts_route')) {
      var fontsRoute = config.get('server.fonts_route');
      app.get('/' + fontsRoute + 'native/:fontname', fontService.getFont);
      app.get('/' + fontsRoute + 'js/:fontname', fontService.getFont);
      app.get('/' + fontsRoute + 'odttf/:fontname', fontService.getFont);
    }

    app.get('/ConvertService.ashx', checkClientIp, rawFileParser, converterService.convert);
    app.post('/ConvertService.ashx', checkClientIp, rawFileParser, converterService.convert);


    app.get('/FileUploader.ashx', checkClientIp, rawFileParser, fileUploaderService.uploadTempFile);
    app.post('/FileUploader.ashx', checkClientIp, rawFileParser, fileUploaderService.uploadTempFile);

    var docIdRegExp = new RegExp("^[" + constants.DOC_ID_PATTERN + "]*$", 'i');
    app.param('docid', (req, res, next, val) => {
      if (docIdRegExp.test(val)) {
        next();
      } else {
        res.sendStatus(403);
      }
    });
    app.param('index', (req, res, next, val) => {
      if (!isNaN(parseInt(val))) {
        next();
      } else {
        res.sendStatus(403);
      }
    });
    app.post('/uploadold/:docid/:userid/:index/:jwt?', fileUploaderService.uploadImageFileOld);
    app.post('/upload/:docid/:userid/:index/:jwt?', rawFileParser, fileUploaderService.uploadImageFile);

    app.post('/downloadas/:docid', rawFileParser, canvasService.downloadAs);
    app.get('/healthcheck', checkClientIp, converterService.convertHealthCheck);
  });

  process.on('message', (msg) => {
    if (!docsCoServer) {
      return;
    }
    docsCoServer.setLicenseInfo(msg.data);
  });
}

process.on('uncaughtException', (err) => {
  logger.error((new Date).toUTCString() + ' uncaughtException:', err.message);
  logger.error(err.stack);
  logger.shutdown(() => {
    process.exit(1);
  });
});
