'use strict';

/*
 * PayPlug API for NodeJS. Developped first by clouderial.com for its own use and given to the community
 */

/*
 * This module holds the main class and entry point to the API
 */

var _ = require('lodash'),
    Q = require('q'),
    log = require('log4js').getLogger('ppnjs.PayPlugAPI'),
    jmcnetException = require('jmcnet').exception,
    util = require('util'),
    https = require('https'),
    http = require('http'),
    url = require('url');

var PAYPLUG_URL = 'https://api.payplug.com/';

/**
 * Instanciate a new PayPlugAPI connector.
 * @param secretKey   String    The secret key. Must be retrieved from https://www.payplug.com/portal2/#/account/customization
 * @param options     Object    Some options :
 *    - payplugUrl    String  The base PayPlug URL of API. Defaults to https://api.payplug.com/
 * 	  - sucessReturnUrl		String the return Url to which user is redirected after successfull payment. Must be terminated with '?<param>='. The api will add automatically the paymentTracker at the end
 * 	  - cancelReturnUrl		String the return Url to which user is redirected after cancelled payment. Must be terminated with '?<param>='. The api will add automatically the paymentTracker at the end
 * 	  - notificationUrl		String the Url called by PayPlug for notifications on the payment. Must be terminated with '?<param>='. The api will add automatically the paymentTracker at the end
 * @return [nothing]
 * @see PayPlugAPI.getPayPlugURL return the value of options.payplugUrl
 */
var PayPlugAPI = function (secretKey, options) {
    if (_.isEmpty(secretKey)) {
        log.error('Cannot create PayPlugAPI without secretKey');
        throw new jmcnetException.TechnicalException('secret key is mandatory');
    }
    this.secretKey = secretKey;
    this.authenticated = false;
    this.options = _.extend({
        payplugUrl: PAYPLUG_URL,
        sucessReturnUrl: 'https://example.net/success?tracker=',
        cancelReturnUrl: 'https://example.net/cancel?tracker=',
        notificationUrl: 'https://example.net/notifications?tracker=',
    }, options);
    // Add a trailing / in base URL
    if (!_.endsWith(this.options.payplugUrl, '/'))
        this.options.payplugUrl += '/';
    log.trace('PayPlugAPI options are "%s"', util.inspect(this.options));
};

/**
 * Do the authentication against PayPlug server.
 * @return promise  A promise resolved if authentication is successfull or reject if not
 */
PayPlugAPI.prototype.authenticate = function () {
    log.info('Calling authenticate');
    var deferred = Q.defer();
    var me = this;
    this.doGet('/v1/payments?page=1&per_page=0')
        .then(function (res) {
            log.info('We are successfully connected to PayPlug Server at "%s"', me.options.payplugUrl);
            me.authenticated = true;
            deferred.resolve();
        })
        .fail(function (res) {
            log.error('Cannot authenticate against PayPlug server at "%s" cause "%s"', me.options.payplugUrl, res.toString());
            me.authenticated = false;
            deferred.reject(res);
        })
        .done();
    log.trace('Return authenticate.promise');
    return deferred.promise;
};

PayPlugAPI.prototype.doSend = function (method, path, body) {
    var deferred = Q.defer();
    
    var bodyStr = _.isEmpty(body) ? '':JSON.stringify(body);
	
	// To take care of UTF-8 caracters encoding length
	function byteLength(str) {
	  // returns the byte length of an utf8 string
	  var s = str.length;
	  for (var i=str.length-1; i>=0; i--) {
		var code = str.charCodeAt(i);
		if (code > 0x7f && code <= 0x7ff) s++;
		else if (code > 0x7ff && code <= 0xffff) s+=2;
		if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
	  }
	  return s;
	}
    
    var u = url.parse(this.options.payplugUrl);
    var httpOptions = {
        protocol: u.protocol,
        hostname: u.hostname,
        method: method,
        path: path,
        headers: {
            'Authorization': 'Bearer ' + this.secretKey
        }
    };
	
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
		httpOptions.headers['Content-type'] = 'application/json; charset=utf-8';
        httpOptions.headers['Content-length'] = byteLength(bodyStr);
	}

    // TODO Mask bearer in log
    log.trace('We will Do %s with "%s"', method, util.inspect(httpOptions));
    log.info(' --> %s "%s"', method, path);
    var req;
    var cb = function (res) {
		var body='';
		res.on('data', function(chunk){
			log.trace('Receive body response chunk : "%s"', chunk);
			body += chunk;
		});
		res.on('end', function() {
    		log.trace('No more data in response.');
			log.info(' <-- %s "%s" : status="%s" (%s) : body="%s"', method, path, res.statusCode, res.statusMessage, body);
			if (res.statusCode >= 200 && res.statusCode < 400) {
				log.debug('Request is OK');
                return deferred.resolve(JSON.parse(body));
			} else {
				log.debug('Request is KO. Reject the promise');

				if (res.statusCode > 499) {
                    return deferred.reject(new jmcnetException.TechnicalException(body, [ res.statusCode, res.statusMessage, res.req.method+' '+res.req.path]));
				}
				else {
                    return deferred.reject(new jmcnetException.FunctionalException(body, [ res.statusCode, res.statusMessage, res.req.method+' '+res.req.path]));
				}
			}
  		});
    };
    if (_.startsWith(u.protocol, 'https')) {
        req = https.request(httpOptions, cb);
    } else {
        req = http.request(httpOptions, cb);
    }
    //	log.trace('Request : "%s"', util.inspect(req));
    if (!_.isEmpty(body)) {
        log.trace('Post the body into request: "%s"', bodyStr);
        req.write(bodyStr);
    }

    req.on('error', function (err) {
        deferred.reject(err);
    });
    req.end();
    return deferred.promise;
};

PayPlugAPI.prototype.doGet = function (path) {
    return this.doSend('GET', path);
};

PayPlugAPI.prototype.doPost = function (path, body) {
    return this.doSend('POST', path, body);
};

PayPlugAPI.prototype.doPatch = function (path, body) {
    return this.doSend('PATCH', path, body);
};

PayPlugAPI.prototype.getPayPlugURL = function () {
    log.trace('PayPlugAPI options are "%s"', util.inspect(this.options));
    return this.options.payplugUrl;
};

module.exports = {
    DEFAULT_PAYPLUG_URL: PAYPLUG_URL,
    PayPlugAPI: PayPlugAPI,
    Payment: require('./payment.js').Payment
};