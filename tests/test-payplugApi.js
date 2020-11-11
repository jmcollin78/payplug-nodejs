/* jshint expr:true*/
'use strict';

/*
 * PayPlug API for NodeJS. Developped first by clouderial.com for its own use and given to the community
 */

/*
 * This module test the main class and entry point to the API
 */

/**
 * Module dependencies.
 */
var expect = require('chai').expect; // jshint ignore:line
var log = require('log4js').getLogger('testu'),
    jmcnet = require('jmcnet'),
    jmcnetException = jmcnet.exception,
    //    _ = require('lodash'),
    ppnj = require('lib/payplug-nodejs.js'),
    PayPlugAPI = ppnj.PayPlugAPI,
    config = require('tests/config.json');

// The tests
describe('<PlayPlug API Unit Test>', function () {
    var payplugapi;
    before(function (done) {
        done();
    });

    it('Should be not possible to instanciate PayPlugAPI without secretKey', function (done) {
        try {
            payplugapi = new PayPlugAPI();
            done('we should not be there');
        } catch (err) {
            expect(err).to.be.instanceof(jmcnetException.TechnicalException);
            done();
        }
    });

    it('Should be possible to instanciate PayPlugAPI with a wrong secretKey and no options', function (done) {
        payplugapi = new PayPlugAPI('wrongSecretKey');
        expect(payplugapi.getPayPlugURL()).to.equal(ppnj.DEFAULT_PAYPLUG_URL);
        done();
    });

    it('Should be possible to instanciate PayPlugAPI with a wrong secretKey and a default URL in options', function (done) {
        payplugapi = new PayPlugAPI('wrongSecretKey', {
            payplugUrl: 'http://a.fake.url'
        });
        expect(payplugapi.getPayPlugURL()).to.equal('http://a.fake.url/');
        done();
    });

    it('Should be not possible to authenticate with a wrong secretKey against real URL', function (done) {
        log.debug('--> Testing "Should be not possible to authenticate with a wrong secretKey against real URL"');
        payplugapi = new PayPlugAPI('aWrongSecretKey');
        payplugapi.authenticate()
            .then(function (result) {
                done('Should not be there');
            })
            .fail(function (err) {
                expect(err).to.be.instanceof(jmcnetException.FunctionalException);
                expect(err.message).to.contains('The API key you provided (*************ey) is not valid');
                expect(err.parameters[0]).to.equal(401);
                expect(err.parameters[1]).to.equal('Unauthorized');
                expect(err.parameters[2]).to.equal('GET /v1/payments?page=1&per_page=0');
                expect(payplugapi.authenticated).to.be.false;
                log.debug('<-- EndOf "Should be possible to authenticate with a real secretKey"');
                done();
            })
            .done();
    });

    /*
     * For this test to work you must supply a configuration properties file on tests/config.json
     */
    it('Should be possible to authenticate with a real secretKey', function (done) {
        log.debug('--> Testing "Should be possible to authenticate with a real secretKey"');
        payplugapi = new PayPlugAPI(config.testSecretKey);
        payplugapi.authenticate()
            .then(function (result) {
                expect(payplugapi.authenticated).to.be.true;
                log.debug('<-- EndOf "Should be possible to authenticate with a real secretKey"');
                done();
            })
            .fail(done)
            .done();
    });

});