/*
 
 Why `lib2`?

 After months of inactivity i readapted this project in order to be
 used again, and i found that the code was using a lot of global
 variables and there was not much to be reused. Probably some parts of
 `lib` could be deleted, but for the moment refactoring is more
 expensive than starting from scratch, at least for the goal of
 sending mobile messages. So i am starting `lib2` with the code that
 is just needed currently for Sense, while `lib` is still available
 around, so functions from both files can be used.

 Francesco Occhipinti, August 2015

 */

var assert = require('assert'),
    PouchDB = require('pouchdb'),
    _ = require('lodash'),
    flatten = require('flat'),
    request = require('request'),
    raven = require('raven'),
    log = require('loglevel'),
    sentryEndpoint = 'https://73134a7f0b994921808bfac454af4c78:369aeb7cae02496ba255b60ad352097e@app.getsentry.com/50531';

function withOptions(options) {
  assert(options.database, 'Pouch requires a database name');
  var db = new PouchDB(options.database),
      configurationId = 'sense-dispatch-configuration',
      client = new raven.Client(sentryEndpoint);

  options.debug && log.setLevel('debug');

  client.patchGlobal(function() {
    log.error('Uncaught exception, terminating');
    process.exit(1);
  });

  function captureMessage(text, options) {
    log.error(text);
    log.error(JSON.stringify(options.extra));
    client.captureMessage.apply(client, arguments);
  }
  function listenChanges(options) {
    // the options used identify this change emitter
    var ident = JSON.stringify(options);
    log.debug('listening for changes with options '+ident);
    // some options are always used, i omitted them from `ident` in
    // order to make logs easier to follow
    var complete = _.defaults(options, {
      live: true,
      include_docs: true,
      since: 'now'
    });
    var changes = db.changes(complete);
    changes
      .on('change', function() {
        log.debug('change detected');
        log.debug(arguments);
      })
      .on('error', function(err) {
        var text = 'change with options '+ident+' found an error'; 
        captureMessage(text, { extra:err });
      })
      .on('complete', function() {
        var text = 'a changes feed terminated';
        captureMessage(text, { extra:err });
      });
    return changes;
  }

  /* this is a nice place where to do some consistency check, for
   * example where to check that the Telerivet endpoint is reachable,
   * options are defined, etcetera. this would allow to spot errors
   * early during initialisation, instead of during operations */
  
  return {
    configurationDocument: {
      getInitial: function() {
        return db.get(configurationId);
      },
      getChanges: function() {
        return listenChanges({
          doc_ids: [configurationId],
        });
      }
    },
    captureMessage: captureMessage,
    captureError: client.captureError.bind(client),
    getChanges: function() {
      return listenChanges({
        filter: '_view',
        view: 'dashboard/symptomatic-followups-by-dateofvisit'
      });
    },
    sendToMobile: function(message) {
      log.debug('sending '+JSON.stringify(message));
      request({
        json: true,
        body: {
          content: message.content,
          to_number: message.to
        },
        method: 'POST',
        url: options.gateway
      }, function(error, response, body) {
        if (!error) {
          log.debug('message sent to '+message.to);
          log.debug('response is '+JSON.stringify(response));
        } else {
          captureMessage(error, {
            extra: {
              response: JSON.stringify(response),
              body: JSON.stringify(body)
            }
          });
        }
      });
    }
  };
}

function dispatch(obj) {
  var render = _.template(obj.configurationDocument.template),
      content = render(flatten(obj.change)),
      outgoing = obj.configurationDocument.recipients.map(function(recipient) {
        return {
          to: recipient,
          content: content
        };
      });
  log.debug('dispatching '+outgoing.length+' messages');
  return outgoing;
}

module.exports = {
  withOptions: withOptions,
  dispatch: dispatch,
  log: log
}
