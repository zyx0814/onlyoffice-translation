/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */


'use strict';
var events = require('events');
var util = require('util');
var co = require('co');
var utils = require('./../../Common/sources/utils');
var rabbitMQCore = require('./../../Common/sources/rabbitMQCore');

var cfgRabbitExchangePubSub = require('config').get('rabbitmq.exchangepubsub');

function init(pubsub, callback) {
  return co(function* () {
    var e = null;
    try {
      var conn = yield rabbitMQCore.connetPromise(function() {
        clear(pubsub);
        if (!pubsub.isClose) {
          init(pubsub, null);
        }
      });
      pubsub.connection = conn;
      pubsub.channelPublish = yield rabbitMQCore.createChannelPromise(conn);
      pubsub.exchangePublish = yield rabbitMQCore.assertExchangePromise(pubsub.channelPublish, cfgRabbitExchangePubSub,
        'fanout', {durable: true});

      pubsub.channelReceive = yield rabbitMQCore.createChannelPromise(conn);
      var queue = yield rabbitMQCore.assertQueuePromise(pubsub.channelReceive, '', {autoDelete: true, exclusive: true});
      pubsub.channelReceive.bindQueue(queue, cfgRabbitExchangePubSub, '');
      yield rabbitMQCore.consumePromise(pubsub.channelReceive, queue, function (message) {
        if(null != pubsub.channelReceive){
          if (message) {
            pubsub.emit('message', message.content.toString());
          }
          pubsub.channelReceive.ack(message);
        }
      }, {noAck: false});
      repeat(pubsub);
    } catch (err) {
      e = err;
    }
    if (callback) {
      callback(e);
    }
  });
}
function clear(pubsub) {
  pubsub.channelPublish = null;
  pubsub.exchangePublish = null;
  pubsub.channelReceive = null;
}
function repeat(pubsub) {
  for (var i = 0; i < pubsub.publishStore.length; ++i) {
    publish(pubsub, pubsub.publishStore[i]);
  }
  pubsub.publishStore.length = 0;
}
function publish(pubsub, data) {
  pubsub.channelPublish.publish(pubsub.exchangePublish, '', data);
}

function PubsubRabbitMQ() {
  this.isClose = false;
  this.connection = null;
  this.channelPublish = null;
  this.exchangePublish = null;
  this.channelReceive = null;
  this.publishStore = [];
}
util.inherits(PubsubRabbitMQ, events.EventEmitter);
PubsubRabbitMQ.prototype.init = function (callback) {
  init(this, callback);
};
PubsubRabbitMQ.prototype.initPromise = function() {
  var t = this;
  return new Promise(function(resolve, reject) {
    init(t, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
PubsubRabbitMQ.prototype.publish = function (message) {
  var data = new Buffer(message);
  if (null != this.channelPublish) {
    publish(this, data);
  } else {
    this.publishStore.push(data);
  }
};
PubsubRabbitMQ.prototype.close = function() {
  var t = this;
  this.isClose = true;
  return new Promise(function(resolve, reject) {
    t.connection.close(function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

module.exports = PubsubRabbitMQ;
