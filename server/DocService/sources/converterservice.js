/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */


var config = require('config');
var co = require('co');
const forwarded = require('forwarded');
var taskResult = require('./taskresult');
var logger = require('./../../Common/sources/logger');
var utils = require('./../../Common/sources/utils');
var constants = require('./../../Common/sources/constants');
var commonDefines = require('./../../Common/sources/commondefines');
var docsCoServer = require('./DocsCoServer');
var canvasService = require('./canvasservice');
var storage = require('./../../Common/sources/storage-base');
var formatChecker = require('./../../Common/sources/formatchecker');
var statsDClient = require('./../../Common/sources/statsdclient');

var cfgHealthCheckFilePath = config.get('services.CoAuthoring.server.healthcheckfilepath');
var cfgVisibilityTimeout = config.get('queue.visibilityTimeout');
var cfgQueueRetentionPeriod = config.get('queue.retentionPeriod');
var cfgTokenEnableRequestInbox = config.get('services.CoAuthoring.token.enable.request.inbox');

var CONVERT_TIMEOUT = 1.5 * (cfgVisibilityTimeout + cfgQueueRetentionPeriod) * 1000;
var CONVERT_ASYNC_DELAY = 1000;

var clientStatsD = statsDClient.getClient();

function* getConvertStatus(cmd, selectRes, baseUrl) {
  var status = {url: undefined, err: constants.NO_ERROR};
  if (selectRes.length > 0) {
    var docId = cmd.getDocId();
    var row = selectRes[0];
    switch (row.status) {
      case taskResult.FileStatus.Ok:
        status.url = yield storage.getSignedUrl(baseUrl, docId + '/' + cmd.getTitle());
        break;
      case taskResult.FileStatus.Err:
      case taskResult.FileStatus.ErrToReload:
        status.err = row.status_info;
        if (taskResult.FileStatus.ErrToReload == row.status) {
          yield canvasService.cleanupCache(docId);
        }
        break;
      case taskResult.FileStatus.NeedParams:
      case taskResult.FileStatus.SaveVersion:
      case taskResult.FileStatus.UpdateVersion:
        status.err = constants.UNKNOWN;
        break;
      case taskResult.FileStatus.NeedPassword:
        status.err = row.status_info;
        break;
    }
    var lastOpenDate = row.last_open_date;
    if (new Date().getTime() - lastOpenDate.getTime() > CONVERT_TIMEOUT) {
      status.err = constants.CONVERT_TIMEOUT;
    }
  }
  return status;
}

function* convertByCmd(cmd, async, baseUrl, opt_healthcheck) {
  var docId = cmd.getDocId();
  var startDate = null;
  if (clientStatsD) {
    startDate = new Date();
  }
  logger.debug('Start convert request docId = %s', docId);

  var task = new taskResult.TaskResultData();
  task.key = docId;
  task.status = taskResult.FileStatus.WaitQueue;
  task.statusInfo = constants.NO_ERROR;
  task.title = cmd.getTitle();

  var upsertRes = yield taskResult.upsert(task);
  var bCreate = upsertRes.affectedRows == 1;
  var selectRes;
  var status;
  if (!bCreate && !opt_healthcheck) {
    selectRes = yield taskResult.select(docId);
    status = yield* getConvertStatus(cmd, selectRes, baseUrl);
  } else {
    var queueData = new commonDefines.TaskQueueData();
    queueData.setCmd(cmd);
    queueData.setToFile(cmd.getTitle());
    if (opt_healthcheck) {
      queueData.setFromOrigin(true);
    }
    yield* docsCoServer.addTask(queueData, constants.QUEUE_PRIORITY_LOW);
    status = {url: undefined, err: constants.NO_ERROR};
  }
  if (!async) {
    var waitTime = 0;
    while (true) {
      if (status.url || constants.NO_ERROR != status.err) {
        break;
      }
      yield utils.sleep(CONVERT_ASYNC_DELAY);
      selectRes = yield taskResult.select(docId);
      status = yield* getConvertStatus(cmd, selectRes, baseUrl);
      waitTime += CONVERT_ASYNC_DELAY;
      if (waitTime > CONVERT_TIMEOUT) {
        status.err = constants.CONVERT_TIMEOUT;
      }
    }
  }
  logger.debug('End convert request url %s status %s docId = %s', status.url, status.err, docId);
  if (clientStatsD) {
    clientStatsD.timing('coauth.convertservice', new Date() - startDate);
  }
  return status;
}

function convertHealthCheck(req, res) {
  return co(function* () {
    var output = false;
    try {
      logger.debug('Start convertHealthCheck');
      var task = yield* taskResult.addRandomKeyTask('healthcheck');
      var docId = task.key;
      var data = yield utils.readFile(cfgHealthCheckFilePath);
      var format = 'docx';
      yield storage.putObject(docId + '/origin.' + format, data, data.length);
      var cmd = new commonDefines.InputCommand();
      cmd.setCommand('conv');
      cmd.setSaveKey(docId);
      cmd.setFormat(format);
      cmd.setDocId(docId);
      cmd.setTitle('Editor.bin');
      cmd.setOutputFormat(constants.AVS_OFFICESTUDIO_FILE_CANVAS);

      var status = yield* convertByCmd(cmd, false, utils.getBaseUrlByRequest(req), true);
      if (status && constants.NO_ERROR == status.err) {
        output = true;
      }
      yield canvasService.cleanupCache(docId);
      logger.debug('End convertHealthCheck');
    } catch (e) {
      logger.error('Error convertHealthCheck\r\n%s', e.stack);
    } finally {
      res.send(output.toString());
    }
  });
}

function* convertFromChanges(docId, baseUrl, lastSave, userdata) {
  var cmd = new commonDefines.InputCommand();
  cmd.setCommand('sfcm');
  cmd.setDocId(docId);
  cmd.setOutputFormat(constants.AVS_OFFICESTUDIO_FILE_OTHER_TEAMLAB_INNER);
  cmd.setEmbeddedFonts(false);
  cmd.setCodepage(commonDefines.c_oAscCodePageUtf8);
  cmd.setDelimiter(commonDefines.c_oAscCsvDelimiter.Comma);
  cmd.setLastSave(lastSave);
  cmd.setUserData(userdata);

  yield* canvasService.commandSfctByCmd(cmd);
  return yield* convertByCmd(cmd, true, baseUrl);
}

function convertRequest(req, res) {
  return co(function* () {
    var docId = 'convertRequest';
    try {
      var params;
      if (req.body && Buffer.isBuffer(req.body)) {
        params = JSON.parse(req.body.toString('utf8'));
      } else {
        params = req.query;
      }
      if (cfgTokenEnableRequestInbox) {
        var authError = constants.VKEY;
        var checkJwtRes = docsCoServer.checkJwtHeader(docId, req);
        if (checkJwtRes) {
          if (checkJwtRes.decoded) {
            if (!utils.isEmptyObject(checkJwtRes.decoded.payload)) {
              Object.assign(params, checkJwtRes.decoded.payload);
              authError = constants.NO_ERROR;
            } else if (checkJwtRes.decoded.payloadhash) {
              if (docsCoServer.checkJwtPayloadHash(docId, checkJwtRes.decoded.payloadhash, req.body, checkJwtRes.token)) {
                authError = constants.NO_ERROR;
              }
            } else if (!utils.isEmptyObject(checkJwtRes.decoded.query)) {
              Object.assign(params, checkJwtRes.decoded.query);
              authError = constants.NO_ERROR;
            }
          } else {
            if (constants.JWT_EXPIRED_CODE == checkJwtRes.code) {
              authError = constants.VKEY_KEY_EXPIRE;
            }
          }
        }
        if (authError !== constants.NO_ERROR) {
          utils.fillXmlResponse(res, undefined, authError);
          return;
        }
      }

      var cmd = new commonDefines.InputCommand();
      cmd.setCommand('conv');
      cmd.setUrl(params.url);
      cmd.setEmbeddedFonts(false);//params.embeddedfonts'];
      cmd.setFormat(params.filetype);
      var outputtype = params.outputtype || '';
      docId = 'conv_' + params.key + '_' + outputtype;
      cmd.setDocId(docId);
      cmd.setTitle(constants.OUTPUT_NAME + '.' + outputtype);
      cmd.setOutputFormat(formatChecker.getFormatFromString(outputtype));
      cmd.setCodepage(commonDefines.c_oAscEncodingsMap[params.codePage] || commonDefines.c_oAscCodePageUtf8);
      cmd.setDelimiter(params.delimiter || commonDefines.c_oAscCsvDelimiter.Comma);
      cmd.setDoctParams(params.doctparams);
      cmd.setPassword(params.password);
      var thumbnail = params.thumbnail;
      if (thumbnail) {
        if(typeof thumbnail === 'string'){
          thumbnail = JSON.parse(thumbnail);
        }
        var thumbnailData = new commonDefines.CThumbnailData(thumbnail);
        switch (cmd.getOutputFormat()) {
          case constants.AVS_OFFICESTUDIO_FILE_IMAGE_JPG:
            thumbnailData.setFormat(3);
            break;
          case constants.AVS_OFFICESTUDIO_FILE_IMAGE_PNG:
            thumbnailData.setFormat(4);
            break;
          case constants.AVS_OFFICESTUDIO_FILE_IMAGE_GIF:
            thumbnailData.setFormat(2);
            break;
          case constants.AVS_OFFICESTUDIO_FILE_IMAGE_BMP:
            thumbnailData.setFormat(1);
            break;
        }
        cmd.setThumbnail(thumbnailData);
        cmd.setOutputFormat(constants.AVS_OFFICESTUDIO_FILE_IMAGE);
        if (false == thumbnailData.getFirst()) {
          cmd.setTitle(constants.OUTPUT_NAME + '.zip');
        }
      }
      var async = (typeof params.async === 'string') ? 'true' == params.async : params.async;

      if (constants.AVS_OFFICESTUDIO_FILE_UNKNOWN !== cmd.getOutputFormat()) {
        var status = yield* convertByCmd(cmd, async, utils.getBaseUrlByRequest(req));
        utils.fillXmlResponse(res, status.url, status.err);
      } else {
        var addresses = forwarded(req);
        logger.error('Error convert unknown outputtype: query = %j from = %s docId = %s', params, addresses, docId);
        utils.fillXmlResponse(res, undefined, constants.UNKNOWN);
      }
    }
    catch (e) {
      logger.error('Error convert: docId = %s\r\n%s', docId, e.stack);
      utils.fillXmlResponse(res, undefined, constants.UNKNOWN);
    }
  });
}

exports.convertHealthCheck = convertHealthCheck;
exports.convertFromChanges = convertFromChanges;
exports.convert = convertRequest;
