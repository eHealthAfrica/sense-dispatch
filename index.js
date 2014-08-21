// sense-dispatch
var PouchDB = require('pouchdb');
var log4js = require('log4js');
var request = require('request');
var q = require("q");
var dateFormat = require('dateformat');
var dotenv = require('dotenv');
dotenv.load();
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
var MAX_TEMP = 38.0;
var LOG_CATEGORY = 'SENSE-DISPATCH';
var requestOptions = {
  method: "POST",
  uri: SMS_URI,
  json: smsOptions
};

log4js.configure({
  appenders: [
    { type: 'console' },
    { type: 'file', filename: 'sense-dispatch.log', category: LOG_CATEGORY }
  ]
});
var logger = log4js.getLogger(LOG_CATEGORY);

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
  console.info(alert);
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
  if (!isArray(recipients)) {
    recipients = [];
  }
  alert.type = 'SMS';
  recipients.forEach(function(r) {
    if (r.phoneNo && r.phoneNo.length > 0) {
      var logMsg;
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
    }
  });
};

var processDailyVisits = function(contact) {
  var dailyVisit = getRecentVisit(contact.dailyVisits);
  var visitTemp = dailyVisit.symptoms.temperature;
  if (typeof dailyVisit !== 'undefined' && visitTemp >= MAX_TEMP) {
    var msg = getMsg(contact, dailyVisit);
    getRecipients()
      .then(function(recipients) {
        smsBroadcast(recipients, msg, getAlert(contact, dailyVisit, msg));
      })
      .catch(function(err) {
        logger.error('getRecipients() failed: ' + err);
      });
  }
};

var db = new PouchDB(CONTACTS_DB_URL);
db.changes(options)
  .on('change', function(change) {
    var contact = change.doc;
    processDailyVisits(contact);
  })
  .on('error', function(err) {
    console.log(err);
  });
