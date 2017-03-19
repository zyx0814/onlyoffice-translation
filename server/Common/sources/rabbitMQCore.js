/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */


'use strict';
var config = require('config');
var amqp = require('amqplib/callback_api');
var logger = require('./logger');

var cfgRabbitUrl = config.get('rabbitmq.url');
var cfgRabbitLogin = config.get('rabbitmq.login');
var cfgRabbitPassword = config.get('rabbitmq.password');
var cfgRabbitConnectionTimeout = config.get('rabbitmq.connectionTimeout');
var cfgRabbitAuthMechanism = config.get('rabbitmq.authMechanism');
var cfgRabbitVhost = config.get('rabbitmq.vhost');
var cfgRabbitNoDelay = config.get('rabbitmq.noDelay');
var cfgRabbitSslEnabled = config.get('rabbitmq.sslenabled');

var RECONNECT_TIMEOUT = 1000;

var connetOptions = {
  login: cfgRabbitLogin,
  password: cfgRabbitPassword,
  connectionTimeout: cfgRabbitConnectionTimeout,
  authMechanism: cfgRabbitAuthMechanism,
  vhost: cfgRabbitVhost,
  noDelay: cfgRabbitNoDelay,
  ssl: {
    enabled: cfgRabbitSslEnabled
  }
};

function connetPromise(closeCallback) {
  return new Promise(function(resolve, reject) {
    function startConnect() {
      amqp.connect(cfgRabbitUrl, connetOptions, function(err, conn) {
        if (null != err) {
          logger.error('[AMQP] %s', err.stack);
          setTimeout(startConnect, RECONNECT_TIMEOUT);
        } else {
          conn.on('error', function(err) {
            logger.error('[AMQP] conn error', err.stack);
          });
          var closeEventCallback = function() {
            conn.removeListener('close', closeEventCallback);
            logger.debug('[AMQP] conn close');
            closeCallback();
          };
          conn.on('close', closeEventCallback);
          logger.debug('[AMQP] connected');
          resolve(conn);
        }
      });
    }
    startConnect();
  });
}
function createChannelPromise(conn) {
  return new Promise(function(resolve, reject) {
    conn.createChannel(function(err, channel) {
      if (null != err) {
        reject(err);
      } else {
        resolve(channel);
      }
    });
  });
}
function createConfirmChannelPromise(conn) {
  return new Promise(function(resolve, reject) {
    conn.createConfirmChannel(function(err, channel) {
      if (null != err) {
        reject(err);
      } else {
        resolve(channel);
      }
    });
  });
}
function assertExchangePromise(channel, exchange, type, options) {
  return new Promise(function(resolve, reject) {
    channel.assertExchange(exchange, type, options, function(err, ok) {
      if (null != err) {
        reject(err);
      } else {
        resolve(ok.exchange);
      }
    });
  });
}
function assertQueuePromise(channel, queue, options) {
  return new Promise(function(resolve, reject) {
    channel.assertQueue(queue, options, function(err, ok) {
      if (null != err) {
        reject(err);
      } else {
        resolve(ok.queue);
      }
    });
  });
}
function consumePromise(channel, queue, messageCallback, options) {
  return new Promise(function(resolve, reject) {
    channel.consume(queue, messageCallback, options, function(err, ok) {
      if (null != err) {
        reject(err);
      } else {
        resolve(ok);
      }
    });
  });
}

module.exports.connetPromise = connetPromise;
module.exports.createChannelPromise = createChannelPromise;
module.exports.createConfirmChannelPromise = createConfirmChannelPromise;
module.exports.assertExchangePromise = assertExchangePromise;
module.exports.assertQueuePromise = assertQueuePromise;
module.exports.consumePromise = consumePromise;
