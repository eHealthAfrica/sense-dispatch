var assert = require('assert')
var PouchDB = require('pouchdb')
var _ = require('lodash')
var request = require('request')
var raven = require('raven')
var log = require('loglevel')
var Q = require('q')

var router = require('./router')

var sentryEndpoint = 'https://73134a7f0b994921808bfac454af4c78:369aeb7cae02496ba255b60ad352097e@app.getsentry.com/50531'

var dummyRaven = {
  patchGlobal: function () {},
  captureMessage: function () {},
  captureError: function () {}
}

function addTime () {
  // add timestamps to logged lines
  var originalFactory = log.methodFactory
  log.methodFactory = function (methodName, logLevel, loggerName) {
    var rawMethod = originalFactory(methodName, logLevel, loggerName)
    return function (message) {
      var timestamp = (new Date()).toISOString()
      rawMethod(timestamp + ' - ' + message)
    }
  }
}
addTime()

function withOptions (options) {
  assert(options.database, 'Pouch requires a database name')
  var db = new PouchDB(options.database)
  var configurationId = 'sense-dispatch-configuration'
  var client = options.sentry ? new raven.Client(sentryEndpoint) : dummyRaven
  // change feeds timeout, and Pouch will not store the last sequence
  // number for us. The reactive logic will restart the change feed,
  // but in that short time interval we might lose some events if we
  // just used "now" as a parameter for `since`. Thus we need to keep
  // track of the last sequence number for every change we follow. See
  // also #12
  function followerFactory (name, options) {
    var since = 'now'
    // sometimes we might not receive any `change` event, thus in
    // order to get a recent value for `since` in any case, we create
    // a changes feed which has `live` not set, and we intercept the
    // `complete` event. Note that this is asynchronous and the
    // following code is not waiting for this to happen, thus the
    // first `since` will always have value `"now"`. Anyway `complete`
    // will be triggered almost immediately, so we will have an
    // updated value for `since` for all the remining life of the
    // process
    var oneShotOptions = _.defaults(options, { since: 'now' })
    db.changes(oneShotOptions).on('complete', function (info) {
      since = info.last_seq
      log.debug(name + ' feed stored sequence number ' + since)
    })
    return function () {
      // some options are always used
      var complete = _.defaults(options, {
        live: true,
        include_docs: true,
        since: since
      })
      log.debug(name + ' follower listening for changes with options ' +
                JSON.stringify(complete) +
                ' since sequence number ' + since)
      var changes = db.changes(complete)
      changes
        .on('change', function () {
          log.debug(name + ' feed detected a change')
          log.debug(JSON.stringify(arguments))
          since = arguments[0].seq
          log.debug('stored sequence number ' + since)
        })
        .on('error', function (err) {
          var errorString = String(err)
          var timeouts = [
            'Error: ETIMEDOUT',
            'Error: ESOCKETTIMEDOUT'
          ]
          if (timeouts.indexOf(errorString) === -1) {
            var text = name + ' feed found error ' + errorString
            captureMessage(text, { extra: err })
          } else {
            log.debug(name + ' feed timed out, it will be restarted')
          }
        })
      return changes
    }
  }
  var followers = {
    view: followerFactory('View', {
      filter: '_view',
      view: 'dashboard/symptomatic-followups-not-notified-by-dateofvisit'
    }),
    configuration: followerFactory('Configuration', {
      doc_ids: [configurationId]
    })
  }

  options.debug && log.setLevel('debug')

  client.patchGlobal(function () {
    log.error('Uncaught exception, terminating')
    process.exit(1)
  })

  function captureMessage (text, options) {
    log.error(text)
    log.error(JSON.stringify(options.extra))
    client.captureMessage.apply(client, arguments)
  }
  function inline (obj) {
    var path = obj.configurationDocument.inlinePath
    if (path) {
      var id = _.get(obj.change, path)
      return db
        .get(id)
        .then(function (document) {
          _.set(obj.change, path, document)
          return obj
        })
        .catch(function (error) {
          captureMessage('error inlining document ' + id, { extra: error })
          // returning the object without inlining seems the most
          // reasonable thing we can do here. anyway this will likely
          // lead to an error with templating
          return obj
        })
    } else {
      return Q(obj)
    }
  }

  function markAsStarted (obj) {
    if (obj.change.dispatcherNotification) {
      // this can happen in case the corresponding view is not
      // excluding documents with `dispatcherNotification` set
      return Q.reject('change event collected twice! ' + JSON.stringify(obj))
    } else {
      obj.change.dispatcherNotification = {
        status: 'started'
      }
      return db
        .put(obj.change)
        .then(function () {
          // returning the original object in order to be processed by
          // successive stages
          return obj
        })
    }
  }

  /* this is a nice place where to do some consistency check, for
   * example where to check that the Telerivet endpoint is reachable,
   * options are defined, etcetera. this would allow to spot errors
   * early during initialisation, instead of during operations */

  return {
    followers: followers,
    getFirstConfigurationDocument: function () {
      return db.get(configurationId)
    },
    captureMessage: captureMessage,
    captureError: client.captureError.bind(client),
    inline: inline,
    markAsStarted: markAsStarted,
    sendToMobile: function (message) {
      log.debug('sending ' + JSON.stringify(message))
      request({
        json: true,
        body: {
          content: message.content,
          to_number: message.to
        },
        method: 'POST',
        url: options.gateway
      }, function (error, response, body) {
        if (!error) {
          log.debug('message sent to ' + message.to)
          log.debug('response is ' + JSON.stringify(response))
        } else {
          captureMessage(error, {
            extra: {
              response: JSON.stringify(response),
              body: JSON.stringify(body)
            }
          })
        }
      })
    }
  }
}

function dispatch (obj) {
  var render = _.template(obj.configurationDocument.template)
  var content = render(obj.change)
  var recipients = router.route(
    obj.configurationDocument.routing,
    obj.change
  ).recipients
  var outgoing = recipients.map(function (recipient) {
    return {
      to: recipient,
      content: content
    }
  })
  log.debug('dispatching ' + outgoing.length + ' messages')
  return outgoing
}

module.exports = {
  withOptions: withOptions,
  dispatch: dispatch,
  log: log
}
