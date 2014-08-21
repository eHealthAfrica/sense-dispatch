// sense-dispatch
var config = require('./config/config');
var PouchDB = require('pouchdb');
var log4js = require('log4js');
var dotenv = require('dotenv');

/*jshint camelcase: false */
var options = {
  live: true,
  since: 'now',
  include_docs: true
};

var MAX_TEMP = 38.0;

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
  return;
};

var processDailyVisit = function(dv){
  console.info(dv);
  if(dv.temperature >= MAX_TEMP){
    //TODO: send sms and email here.
  }
};

var db = new PouchDB(config.dbUrl);
db.changes(options)
  .on('change',function(change) {
    var contact = change.doc;
    var dailyVisit = getRecentVisit(contact.dailyVisits);
    if(typeof dailyVisit !== 'undefined'){
      processDailyVisit(dailyVisit);
    }
  })
  .on('error', function(err) {
    console.log(err);
  });
