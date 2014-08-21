// sense-dispatch
var PouchDB = require('pouchdb');
var log4js = require('log4js');
var request = require('request');
var q = require("q");
var dateFormat = require('dateformat');
var dotenv = require('dotenv');
dotenv.load();
var nodeMailer = require("nodemailer");
/*jshint camelcase: false */
var options = {
  live: true,
  since: 'now',
  include_docs: true
};
var smsOptions = {
  "phone_id": process.env.PHONE_ID,
  "to_number": '',
  "content": '',
  "api_key": process.env.API_KEY
};
var SMS_URI = process.env.SMS_URI;
var CONTACTS_DB_URL = process.env.DB_URL;
var ALERTS_DB_URL = process.env.ALERT_DB_URL;
var recipientView = process.env.RECIPIENT_VIEW;
var EMAIL = process.env.EMAIL;
var PWD = process.env.EMAIL_PWD;
var EMAIL_SERVICE = process.env.EMAIL_SERVICE;
var MAX_TEMP = 38.0;
var LOG_CATEGORY = 'SENSE-DISPATCH';
var requestOptions = {
  method: "POST",
  uri: SMS_URI,
  json: smsOptions
};
var mailerSettings = {
  service: EMAIL_SERVICE,
  auth: {
    user: EMAIL,
    pass: PWD
  }
};
log4js.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: 'sense-dispatch.log', category: LOG_CATEGORY }
  ]
});
var logger = log4js.getLogger(LOG_CATEGORY);

var sendEmail = function(recipient, sender, msg, subject, opts) {
  var deferred = q.defer();
  var settings = opts || mailerSettings;
  var smtpTransport = nodeMailer.createTransport("SMTP", settings);
  var mailInfo = {
    from: sender,
    to: recipient,
    subject: subject,
    text: msg
  };
  smtpTransport.sendMail(mailInfo, function(err, res) {
    if (!err) {
      deferred.resolve(res);
    } else {
      deferred.reject(err);
    }
  });
  return deferred.promise;
};


var sendSms = function(recipient, msg, reqOptions) {
  var deferred = q.defer();
  reqOptions.json.to_number = recipient;
  reqOptions.json.content = msg;
  request(reqOptions, function(err, res, body) {
    if (res) {
      deferred.resolve(res.body);
    } else {
      deferred.reject(err);
    }
  });
  return deferred.promise;
};

var isArray = function(o) {
  return Object.prototype.toString.call(o) === '[object Array]';
};

var getRecentVisit = function(dailyVisits) {
  if (isArray(dailyVisits) && dailyVisits.length > 0) {
    var sorted = dailyVisits.sort(function(a, b) {
      return (new Date(b.dateOfVisit).getTime() - new Date(a.dateOfVisit).getTime());
    });
    return sorted[0];
  }
};

var logAlert = function(alert) {
  var db = new PouchDB(ALERTS_DB_URL);
  alert.docType = 'alert';
  alert.sentOn = new Date().toJSON();
  return db.post(alert);
};

var getMsg = function(contact, dv) {
  var name = contact.Surname + ', ' + contact.OtherNames;
  var temp = dv.symptoms.temperature + ' C';
  var dateOfVisit = dateFormat(new Date(dv.dateOfVisit));
  var interviewer = 'From: ' + dv.interviewer;
  var msg = [name, temp, dateOfVisit, interviewer].join('; ');
  return msg;
};

var getRecipients = function() {
  var db = new PouchDB(ALERTS_DB_URL);
  return db.query(recipientView)
    .then(function(res) {
      return res.rows.map(function(r) {
        return r.value;
      });
    });
};

var getAlert = function(contact, dv, msg) {
  return {
    contactId: contact._id,
    dateOfVisit: dv.dateOfVisit,
    msg: msg
  };
};

var smsBroadcast = function(recipients, msg, alert) {
  alert.type = 'SMS';
  var r;
  var logMsg;
  for (var i in recipients) {
    r = recipients[i];
    if (r.phoneNo && r.phoneNo.length > 0) {
      sendSms(r.phoneNo, msg, requestOptions)
        .then(function() {
          logMsg = [
            'SMS sent To: ', r._id,
            ', Phone No:', r.phoneNo,
            ', Message: ', msg
          ].join(' ');
          logger.info(logMsg);
          logAlert(alert)
            .then(function(res) {
              logger.info('Alert Logged to CouchDB: ' + JSON.stringify(res));
            })
            .catch(function(reason) {
              logger.error('CouchDB Alert Log Error: ' + JSON.stringify(reason));
            });
        })
        .catch(function(err) {
          logMsg = [
            'Send SMS Error, To:', r._id,
            ', Phone No:', r.phoneNo,
            ', Message: ', msg,
            ', Reason: ', err
          ].join(' ');
          logger.error(logMsg);
        });
    } else {
      logger.warn('Recipient does not have phone number. Recipient: ' + r.id);
    }
  }
};

var emailBroadcast = function(recipients, msg, alert, subject) {
  alert.type = 'email';
  var title = subject || 'Contact Temperature Alert';
  recipients.forEach(function(r) {
    var logMsg;
    if (r.email && r.email.length > 0) {
      sendEmail(r.email, mailerSettings.auth.user, msg, title)
        .then(function() {
          logMsg = [
            'Email sent To: ', r._id,
            ', email:', r.email,
            ', Message: ', msg
          ].join(' ');
          logger.info(logMsg);
          logAlert(alert)
            .then(function(res) {
              logger.info('Alert Logged to CouchDB: ' + JSON.stringify(res));
            })
            .catch(function(reason) {
              logger.error('CouchDB Alert Log Error: ' + JSON.stringify(reason));
            });
        })
        .catch(function(reason) {
          logMsg = [
            'Email Alert Failed: To: ', r._id,
            ', email: ', r.email,
            ', Message: ', msg,
            'Reason: ', reason
          ].join(' ');
          logger.error(logMsg);
        });
    } else {
      logger.warn('Recipient does not have email. Recipient: ' + r.id);
    }
  });
};

var processDailyVisits = function(contact) {
  var dailyVisit = getRecentVisit(contact.dailyVisits);
  if (typeof dailyVisit !== 'undefined' && typeof dailyVisit.symptoms !== 'undefined'
    && dailyVisit.symptoms.temperature >= MAX_TEMP) {
    var msg = getMsg(contact, dailyVisit);
    getRecipients()
      .then(function(recipients) {
        if (isArray(recipients) && recipients.length > 0) {
          emailBroadcast(recipients, msg, getAlert(contact, dailyVisit, msg));
          smsBroadcast(recipients, msg, getAlert(contact, dailyVisit, msg));
        } else {
          logger.info('Recipient list is empty.');
        }
      })
      .catch(function(err) {
        logger.error('getRecipients() failed: ' + err);
      });
  }
};

var db = new PouchDB(CONTACTS_DB_URL);
var seqBefore;
db.changes(options)
  .on('change', function(change) {
    if (typeof seqBefore === 'undefined') {
      seqBefore = change.seq;
    }
    if (change.seq !== seqBefore) {
      var contact = change.doc;
      processDailyVisits(contact);
    }
  })
  .on('error', function(err) {
    logger.error('DB Changes Error: ' + err);
  });
