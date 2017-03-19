var join = require('path').join;
var crypto = require('crypto');

exports.urlSigner = function(key, secret, options){
  options = options || {};
  var endpoint = options.host || 's3.amazonaws.com';
  var port = options.port || '80';
  var protocol = options.protocol || 'http';
  var subdomain = options.useSubdomain === true;

  var hmacSha1 = function (message) {
    return crypto.createHmac('sha1', secret)
                  .update(message)
                  .digest('base64');
  };
  var getSignature = function(verb, fname, bucket, epo) {
    var str = verb + '\n\n\n' + epo + '\n' + '/' + bucket + (fname[0] === '/'?'':'/') + fname;

    return hmacSha1(str);
  };

  var url = function (fname, bucket) {
      if (subdomain) {
        return protocol + '://'+ bucket + "." + endpoint + (port != 80 ? ':' + port : '') + (fname[0] === '/'?'':'/') + fname;
      } else {
        return protocol + '://'+ endpoint + (port != 80 ? ':' + port : '') + '/' + bucket + (fname[0] === '/'?'':'/') + fname;
      }
  };

  return {
    getUrl : function(verb, fname, bucket, expiresInMinutes, optContentDisposition){
      var expires = new Date();

      var fname4Sign;
      if (optContentDisposition) {
        fname4Sign = fname + '?response-content-disposition=' + optContentDisposition;
      } else {
        fname4Sign = fname;
      }

      expires.setMinutes(expires.getMinutes() + expiresInMinutes);

      var epo = Math.floor(expires.getTime()/1000);

      var hashed = getSignature(verb, fname4Sign, bucket, epo);

      var urlRet = url(fname, bucket) +
        '?Expires=' + epo +
        '&AWSAccessKeyId=' + key +
        '&Signature=' + encodeURIComponent(hashed);
      if (optContentDisposition) {
        urlRet += '&response-content-disposition=' + encodeURIComponent(optContentDisposition);
      }

      return urlRet;

    },
    getSignature : getSignature
  };

};
