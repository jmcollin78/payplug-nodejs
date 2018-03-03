# payplug-nodejs
An NodeJS API for Payplug solution : https://www.payplug.com

This module aims to implement the Curl Payplug API describe here : https://www.payplug.com/docs/api

It is used as payment solution of the StartUp Clouderial (<a href="http://clouderial.com">online project management, invoices, quotation and tasks for independant workers</a>)

## Install
<code>$ npm install payplug-nodejs</code>

## Authenticate against PayPlug API
To authenticate :

<pre>
var PayPlugAPI = require('payplug-nodejs').PayPlugAPI;

var payplugapi = new PayPlugAPI('mySecretKey', {
    // the url called in case of success
    sucessReturnUrl: 'https://[my-url]/payplugapi/test/success?tracker=',
    
    // the url called in case of cancelation
    cancelReturnUrl: 'https://[my-url]/payplugapi/test/cancel?tracker=',
    
    // the notification url. Cf. https://www.payplug.com/docs/api/apiref.html#notifications
    notificationUrl: 'https://[my-url]/payplugapi/test/notifications?tracker='
});

payplugapi.authenticate()
	.then(function (result) {
		// you are authenticated.
		// paypluapi can be use to manage payments
	})
	.fail(function(err){
		log.error('Error while authenticating. Message="%s"', err.message);
	})
	.done();
if (payplugapi.authenticated) {
	// The API is successfully authenticated
}
</pre>

To test if authentication is successfull :
<pre>
if (payplugapi.authenticated) {
	// The API is successfully authenticated
}
</pre>

## Payment
### To create a payment :

<pre>
// Cf above to have an authenticated PayplugApi object
// var payplugapi = new PayPlugAPI('mySecretKey');
// payplugapi.authenticate()
// ... 

// Create a new Payment
var Payment = require('payplug-nodejs').Payment;
payment = new Payment(payplugapi, 'paymentid', {
    'amount': 1000,
    'currency': 'EUR',
    'customer': {
        'email': 'testu@payplug-nodejs.com',
        'first_name': 'ClientFirstname',
        'last_name': 'ClientLastname'
    },
    'save_card': false,
    'force_3ds': true
});

// Send the Payment creation
payment.sendCreate()
    .then(function (newPaymentResult) {
        // The API call is successfull
        // newPaymentResult.payment is Payment updated with id and tracker;
        newPaymentResult.getId();
        newPaymentResult.getTracker();
        newPaymentResult.getPaymentUrl();
        newPaymentResult.getPayplugPayment(); // get the original Payplug payment (as defined in Payplug API)
        
        // if payment OK
        if (newPaymentResult.isFailed()) {
            newPaymentResult.getFailure().code;
            newPaymentResult.getFailure().message;
        }
    })
    .fail(function(err){
        // there have been an error during payment creation
        err.message;
    })
    .done();
</pre>

### To retrieve a payment :

Call this method a retrieve an existing Payment from its id

<pre>
// Cf above to have an authenticated PayplugApi object
// var payplugapi = new PayPlugAPI('mySecretKey');
// payplugapi.authenticate()
// ... 

// Retrieve a Payment with its Id
Payment.retrieve(payplugapi, 'theIDOfPayment')
    .then(function (payment) {
        // The API call is successfull
        // payment updated with id and tracker;
        payment.getId();
        payment.getTracker();
        payment.isPayed();
        payment.isRefunded();
        
        payment.getPayplugPayment(); // get the original Payplug payment (as defined in Payplug API)
        
        // if payment is aborted of failed
        if (newPayemnt.isFailed()) {
            newPayment.getFailure().code;
            newPayment.getFailure().message;
        }
    })
    .fail(function(err){
        // there have been an error during payment creation
        err.message;
    })
    .done();
</pre>

### To abort a payment :

Call this method a abort an existing Payment. Payment should have been send before or retrieved with list or retrieve

<pre>
// Cf above to have an authenticated PayplugApi object
// var payplugapi = new PayPlugAPI('mySecretKey');
// payplugapi.authenticate()
// ... 
// Cf. above to retrieve a Payment
// Payment.retrieve(payplugapi, 'theIDOfPayment')...
// Payment.list(payplugapi)...

// Abort a Payment with its Id
payemnt.sendAbort()
    .then(function (payment) {
        // The API call is successfull
        payment.getId();
        payment.getTracker();

        payment.getPayplugPayment(); // get the original Payplug payment (as defined in Payplug API)
        
        payment.getFailure().code;
        payment.getFailure().message;
        
        expect(newPayment.getFailure().code).to.equal(Payment.ABORT_STATUS);
    })
    .fail(function(err){
        // there have been an error during payment creation
        err.message;
    })
    .done();
</pre>

### To get a Payment from a Payplug payment (found in notification_url for example)

<pre>
    function notificationUrl (req, res, next) {
        ...
        var payment = Payment.fromPayplugPayment(req.body);
        ...
        payment.getId();
        payment.getTracker();

        payment.getPayplugPayment(); // get the original Payplug payment (as defined in Payplug API)

        payment.isFailed();
        payment.isPayed();
        payment.isRefunded();
        payment.getFailure().code;
        payment.getFailure().message;
    }
</pre>


## Tests
To launch the test you must first provide a tests/config.json file with you secret key. Example :

<pre>
{
  "testSecretKey": "sk_test_751BVqbli82hx9hyL5GRGT"
}
</pre>

