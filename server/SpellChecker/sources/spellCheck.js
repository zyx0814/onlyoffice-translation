/*
 * (c) Copyright Ascensio System Limited 2010-2017. All rights reserved
 *
 * http://www.teamlab.com 
 *
 * Version: 4.2.10 (build:10)
 */


var sockjs = require('sockjs'),
	nodehun = require('nodehun'),
    config = require('config').get('SpellChecker'),
	logger = require('./../../Common/sources/logger'),
	fs = require('fs'),
	cfgSockjsUrl = require('config').get('services.CoAuthoring.server.sockjsUrl');
var arrDictionaries = {};

(function() {
	var arrDictionariesConfig = config.get('dictionaries');
	var oDictTmp = null, pathTmp = '', oDictName = null;
	for (var indexDict = 0, lengthDict = arrDictionariesConfig.length; indexDict < lengthDict; ++indexDict) {
		oDictTmp = arrDictionariesConfig[indexDict];
		oDictName = oDictTmp.name;
		pathTmp = __dirname + '/../dictionaries/' + oDictName + '/' + oDictName + '.';
		arrDictionaries[oDictTmp.id] = new nodehun(fs.readFileSync(pathTmp + 'aff'), fs.readFileSync(pathTmp + 'dic'));
	}
})();
 
exports.install = function (server, callbackFunction) {
	'use strict';
	var sockjs_opts = {sockjs_url: cfgSockjsUrl},
		sockjs_echo = sockjs.createServer(sockjs_opts);

	sockjs_echo.on('connection', function (conn) {
		if (null == conn) {
			logger.error ("null == conn");
			return;
		}
		conn.on('data', function (message) {
			try {
				var data = JSON.parse(message);
				switch (data.type) {
					case 'spellCheck':	spellCheck(conn, data);break;
				}
			} catch (e) {
				logger.error("error receiving response: %s", e);
			}
		});
		conn.on('error', function () {
			logger.error("On error");
		});
		conn.on('close', function () {
			logger.info("Connection closed or timed out");
		});
	});

	function sendData(conn, data) {
		conn.write(JSON.stringify(data));
	}

	function spellCheck(conn, data) {
		var oSpellInfo;
		function checkEnd() {
			if (0 === oSpellInfo.usrWordsLength) {
				sendData(conn, { type:"spellCheck", spellCheckData:JSON.stringify(data) });
			}
		}
		function spellSuggest(index, word, lang) {
			oSpellInfo.arrTimes[index] = new Date();
			logger.info('start %s word = %s, lang = %s', data.type, word, lang);
			var oDictionary = arrDictionaries[lang];
			if (undefined === oDictionary) {
				data.usrCorrect[index] = false;
				--data.usrWordsLength;
				checkEnd();
			} else if ("spell" === data.type) {
				oDictionary.isCorrect(word, function (err, correct, origWord) {
					data.usrCorrect[index] = (!err && correct);
					logger.info('spell word = %s, lang = %s, time = %s', word, lang, new Date() - oSpellInfo.arrTimes[index]);
					--oSpellInfo.usrWordsLength;
					checkEnd();
				});
			} else if ("suggest" === data.type) {
				oDictionary.spellSuggestions(word, function (err, correct, suggestions, origWord) {
					data.usrSuggest[index] = suggestions;
					logger.info('suggest word = %s, lang = %s, time = %s', word, lang, new Date() - oSpellInfo.arrTimes[index]);
					--oSpellInfo.usrWordsLength;
					checkEnd();
				});
			}
		}

		data = JSON.parse(data.spellCheckData);
		data.usrCorrect = [];
		data.usrSuggest = [];

		oSpellInfo = {usrWordsLength: data.usrWords.length, arrTimes: []};
		for (var i = 0, length = data.usrWords.length; i < length; ++i) {
			spellSuggest(i, data.usrWords[i], data.usrLang[i]);
		}
	}

	sockjs_echo.installHandlers(server, {prefix:'/doc/[0-9-.a-zA-Z_=]*/c', log:function (severity, message) {
		logger.info(message);
	}});

	callbackFunction();
};
exports.spellSuggest = function (type, word, lang, callbackFunction) {
	var oDictionary = arrDictionaries[lang];
	if (undefined === oDictionary) {
		callbackFunction(false);
	} else if ('spell' === type) {
		oDictionary.isCorrect(word, function (err, correct, origWord) {
			callbackFunction(!err && correct);
		});
	} else if ('suggest' === type) {
		oDictionary.spellSuggestions(word, function (err, correct, suggestions, origWord) {
			callbackFunction(suggestions);
		});
	}
};
