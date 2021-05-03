'use strict';

/*
 * PayPlug API for NodeJS. Developped first by clouderial.com for its own use and given to the community
 */

/*
 * This module holds the Payment class which holds all payment feature
 */
const
    log4js = require('log4js'),
    jsonLayout = require('log4js-json-layout');
log4js.addLayout('json', jsonLayout);

var _ = require('lodash'),
    Q = require('q'),
    log = log4js.getLogger('ppnjs.Payment'),
    jmcnetException = require('jmcnet').exception,
    util = require('util');

/**
 * Instanciate a new Payment.
 * @param payplugApi Object  The PayplugAPI with sucessfull authentication
 * @param paymentTracker String  A payment tracker (id) that will be send and received by PayPlug API to follow the payment. This tracked will be inserted in metadata
 * @param payment   Object  The payment options. More informations here : https://www.payplug.com/docs/api/apiref.html?powershell#create-a-payment
 * @return [nothing]
 * @see PayPlugAPI.authenticate The authentication method
 */
var Payment = function (payplugApi, paymentTracker, payment) {
    log.debug('CTOR payplugApi="%s", paymentTracker="%s", payment="%s"', payplugApi, paymentTracker, payment);
    if (_.isEmpty(payplugApi) || !payplugApi.authenticated) {
        log.error('Cannot create Payment without authenticated payplugApi');
        if (payplugApi) {
            throw new jmcnetException.FunctionalException('The API must be authenticated to create a Payment.');
        } else {
            throw new jmcnetException.TechnicalException('You must be provide an authenticated PayplugAPI instance to create a Payment.');
        }
    }
    if (_.isEmpty(paymentTracker)) {
        log.error('Cannot create Payment without "paymentTracker"');
        throw new jmcnetException.TechnicalException('You must be provide an paymentTracker to create a Payment.');
    }
    this.payplugApi = payplugApi;
    this.payment = _.extend({
        hosted_payment: {
            return_url: payplugApi.options.sucessReturnUrl + paymentTracker,
            cancel_url: payplugApi.options.cancelReturnUrl + paymentTracker
        },
        notification_url: payplugApi.options.notificationUrl + paymentTracker
    }, payment);

    // force adding tracker into metadata
    if (!this.payment.metadata) {
        this.payment.metadata = {};
    }
    this.payment.metadata.paymentTracker = paymentTracker;

    log.trace('Payment is "%s"', util.inspect(this.payment));
};

Payment.toString = function () {
    return '{payment: { paymentTracker: ' + this.paymentTracker + ', amount:' + this.payment.amount + ' currency: ' + this.payment.currency + '}}';
};


Payment.ABORT_STATUS = 'aborted';

/**
 * List all payments created with the API. Return is like the following:
 * {
 *   "object": "list",
 *   "page": 0,
 *   "per_page": 10,
 *   "has_more": true,
 *   "data": [ {
 *       "id": "pay_5iHMDxy4ABR4YBVW4UscIn",
 *       "object": "payment",
 *       "is_live": true,
 *       "amount": 3300
 *   } ]
 *}
 * @param   {object}  payplugApi The authenticated instance of PayPlugAPI object
 * @param   int         perPage the number of item per page (default = 100)
 * @param   int         page    the page number to retreive. Default to 0
 * @returns {promise} A promise resolving to the list of payment if any. Cf. above
 */
Payment.list = function (payplugApi, perPage, page) {
    log.info('Calling Payment.list');

    var deferred = Q.defer();
    
    var url='/v1/payments';
    if (page || perPage) {
        url += '?page='+(page ? page:0)+'&per_page='+(perPage ? perPage:100);
    }

    payplugApi.doGet('/v1/payments')
        .then(function (res) {
            log.debug('Payments are successfully listed');
            // transform response into Payment Object
            var ret = _.map(_.filter(res.data, function (p) {
                return !_.isUndefined(p.metadata.paymentTracker);
            }), function (p) {
                return new Payment(payplugApi, p.metadata.paymentTracker, p);
            });
            log.trace('Payment list received is "%s"', util.inspect(ret));
            deferred.resolve(ret);
        })
        .fail(deferred.reject)
        .done();

    return deferred.promise;
};

Payment.retrieve = function (payplugApi, id) {
    log.info('Calling Payment.retrieve id="%s"', id);
    if (_.isEmpty(id)) {
        return Q.reject(new jmcnetException.TechnicalException('You must provided an id to retrieve a payment'));
    }
    var deferred = Q.defer();

    payplugApi.doGet('/v1/payments/' + id)
        .then(function (res) {
            log.debug('Payment is successfully retrieved. Return is "%s"', util.inspect(res));
            var ret = new Payment(payplugApi, res.metadata.paymentTracker, res);
            log.trace('Payment retrieved is "%s"', util.inspect(ret));
            deferred.resolve(ret);
        })
        .fail(deferred.reject)
        .done();

    return deferred.promise;
};

Payment.prototype.sendCreate = function () {
    log.info('Calling Payment.sendCreate payment="%s"', this.toString());

    var me = this;
    var deferred = Q.defer();

    me.payplugApi.doPost('/v1/payments', me.payment)
        .then(function (res) {
            log.debug('Payment is sucessfully send. Return is "%s"', util.inspect(res));
            me.payment = _.extend(me.payment, res);
            deferred.resolve(me);
        })
        .fail(deferred.reject)
        .done();

    return deferred.promise;
};

Payment.prototype.sendAbort = function () {
    log.info('Calling Payment.sendAbort payment="%s"', this.toString());

    var me = this;
    var deferred = Q.defer();

    me.payplugApi.doPatch('/v1/payments/' + me.getId(), {
            'abort': true
        })
        .then(function (res) {
            log.debug('Payment is sucessfully aborted. Return is "%s"', util.inspect(res));
            me.payment = _.extend(me.payment, res);
            deferred.resolve(me);
        })
        .fail(deferred.reject)
        .done();

    return deferred.promise;
};

// TODO not tested
Payment.fromPayplugPayment = function(payplugApi, payplugPayment) {
    if (_.isEmpty(payplugPayment) || _.isEmpty(payplugPayment.metadata) || _.isEmpty(payplugPayment.metadata.paymentTracker)) {
        log.error('Try to create a Payment from an Payplug payment or a Payplug payment without paymentTracker in metadata. PayplugPayment is "%s"', util.inspect(payplugPayment));
        throw new jmcnetException.TechnicalException('cannot create Payment from Payplug payment without paymentTracker');
    }
    log.info('Create a payment from its Payplug copy id="%s", tracker="%s"', payplugPayment, payplugPayment.metadata.paymentTracker);
    return new Payment(payplugApi, payplugPayment.metadata.paymentTracker, payplugPayment);
};

Payment.prototype.getId = function () {
    if (this.payment) return this.payment.id;
    else return undefined;
};

Payment.prototype.getPaymentUrl = function () {
    if (this.payment && this.payment.hosted_payment) return this.payment.hosted_payment.payment_url;
    else return undefined;
};

Payment.prototype.getTracker = function () {
    if (this.payment && this.payment.metadata) return this.payment.metadata.paymentTracker;
    else return undefined;
};

Payment.prototype.getFailure = function () {
    if (this.payment && this.payment.failure) return this.payment.failure;
    else return undefined;
};

Payment.prototype.isFailed = function() {
    return !_.isEmpty(this.payment.failure);
};

Payment.prototype.isPayed = function() {
    return !_.isUndefined(this.payment.is_paid) && this.payment.is_paid;
};

Payment.prototype.isRefunded = function() {
    return !_.isUndefined(this.payment.is_refunded) && this.payment.is_refunded;
};

Payment.prototype.getPayplugPayment = function() {
    return this.payment;
};

module.exports = {
    Payment: Payment
};