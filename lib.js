var assert = require('assert')
var PouchDB = require('pouchdb')
var _ = require('lodash')
var request = require('request')
var raven = require('raven')
var log = require('loglevel')
var Q = require('q')
var sentryEndpoint = 'https://73134a7f0b994921808bfac454af4c78:369aeb7cae02496ba255b60ad352097e@app.getsentry.com/50531'

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
  var client = new raven.Client(sentryEndpoint)

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
  function listenChanges (options) {
    // the options used identify this change emitter
    var ident = JSON.stringify(options)
    log.debug('listening for changes with options ' + ident)
    // some options are always used, i omitted them from `ident` in
    // order to make logs easier to follow
    var complete = _.defaults(options, {
      live: true,
      include_docs: true,
      since: 'now'
    })
    var changes = db.changes(complete)
    changes
      .on('change', function () {
        log.debug('change detected')
        log.debug(arguments)
      })
      .on('error', function (err) {
        var text = 'change with options ' + ident + ' found an error'
        captureMessage(text, { extra: err })
      })
      .on('complete', function (err) {
        var text = 'a changes feed terminated'
        captureMessage(text, { extra: err })
      })
    return changes
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

  /* this is a nice place where to do some consistency check, for
   * example where to check that the Telerivet endpoint is reachable,
   * options are defined, etcetera. this would allow to spot errors
   * early during initialisation, instead of during operations */

  return {
    configurationDocument: {
      getInitial: function () {
        return db.get(configurationId)
      },
      getChanges: function () {
        return listenChanges({
          doc_ids: [configurationId]
        })
      }
    },
    captureMessage: captureMessage,
    captureError: client.captureError.bind(client),
    getChanges: function () {
      return listenChanges({
        filter: '_view',
        view: 'dashboard/symptomatic-followups-by-dateofvisit'
      })
    },
    inline: inline,
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
  var outgoing = obj.configurationDocument.recipients.map(function (recipient) {
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
