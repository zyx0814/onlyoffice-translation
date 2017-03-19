/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */

'use strict';
var config = require('config');
var configCoAuthoring = config.get('services.CoAuthoring');
var co = require('co');
var logger = require('./../../Common/sources/logger');
var pubsubService = require('./' + configCoAuthoring.get('pubsub.name'));
var pubsubRedis = require('./pubsubRedis.js');
var commonDefines = require('./../../Common/sources/commondefines');
var constants = require('./../../Common/sources/constants');
var utils = require('./../../Common/sources/utils');

var cfgVisibilityTimeout = config.get('queue.visibilityTimeout');
var cfgQueueRetentionPeriod = config.get('queue.retentionPeriod');
var cfgRedisPrefix = configCoAuthoring.get('redis.prefix');
var redisKeyShutdown = cfgRedisPrefix + constants.REDIS_KEY_SHUTDOWN;
var redisKeyDocuments = cfgRedisPrefix + constants.REDIS_KEY_DOCUMENTS;

var WAIT_TIMEOUT = 30000;
var LOOP_TIMEOUT = 1000;
var EXEC_TIMEOUT = WAIT_TIMEOUT + 1.5 * (cfgVisibilityTimeout + cfgQueueRetentionPeriod) * 1000;

(function shutdown() {
  return co(function* () {
    var exitCode = 0;
    try {
      logger.debug('shutdown start' + EXEC_TIMEOUT);

      var redisClient = pubsubRedis.getClientRedis();
      var multi = redisClient.multi([
        ['del', redisKeyShutdown],
        ['zcard', redisKeyDocuments]
      ]);
      var multiRes = yield utils.promiseRedis(multi, multi.exec);
      logger.debug('number of open documents %d', multiRes[1]);

      var pubsub = new pubsubService();
      yield pubsub.initPromise();
      logger.debug('shutdown pubsub shutdown message');
      pubsub.publish(JSON.stringify({type: commonDefines.c_oPublishType.shutdown}));
      logger.debug('shutdown start wait pubsub deliver');
      var startTime = new Date().getTime();
      var isStartWait = true;
      while (true) {
        var curTime = new Date().getTime() - startTime;
        if (isStartWait && curTime >= WAIT_TIMEOUT) {
          isStartWait = false;
          logger.debug('shutdown stop wait pubsub deliver');
        } else if(curTime >= EXEC_TIMEOUT) {
          exitCode = 1;
          logger.debug('shutdown timeout');
          break;
        }
        var remainingFiles = yield utils.promiseRedis(redisClient, redisClient.scard, redisKeyShutdown);
        logger.debug('shutdown remaining files:%d', remainingFiles);
        if (!isStartWait && remainingFiles <= 0) {
          break;
        }
        yield utils.sleep(LOOP_TIMEOUT);
      }
      yield utils.promiseRedis(redisClient, redisClient.del, redisKeyShutdown);
      yield pubsub.close();

      logger.debug('shutdown end');
    } catch (e) {
      logger.error('shutdown error:\r\n%s', e.stack);
    } finally {
      process.exit(exitCode);
    }
  });
})();
