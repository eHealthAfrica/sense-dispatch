/* reactive engine. the code here combines functions exposed by the
 * library into a single function to be run. i keep all code depending
 * on Bacon here, so if somebody will want to stop using Bacon in the
 * future, it will be easier */
var lib2 = require('./lib');
var Bacon = require('baconjs');

// this is an adapter function. it gets a Pouch changes object and it
// returns a Bacon stream
function changesToStream(changes, lib) {
  return Bacon.fromBinder(function(sink) {
    changes
      .on('change', function(change) {
        sink(change.doc);
      })
      .on('error', function() {
        sink(new Bacon.End());
      })
      .on('complete', function() {
        sink(new Bacon.End());
      });
  });
}

module.exports.main = function(options, mockedLib) {
  var lib = mockedLib || lib2;
  /* the initial configuration document is fetched from the
   * database. this is updated when a change is detected */
  var withOptions = lib.withOptions(options);
  function onError(err) {
    var text = 'error on a Bacon stream';
    lib.log.error(text);
    lib.log.error(JSON.stringify(err));
    withOptions.captureMessage(text, { extra: err });
  }
  withOptions.configurationDocument
    .getInitial()
    .then(function(firstConfigurationDocument) {
      lib.log.debug('got configuration document '+JSON.stringify(firstConfigurationDocument));
      // expose for tests
      module.exports.firstConfigurationDocument = firstConfigurationDocument;
      var configurationDocuments = (function() {
        /* changes feeds are wrapped into `Bacon.repeat` in order to
         * be robust to network conditions with a small timeout */
        var stream = Bacon.repeat(function() {
          var changes = withOptions.configurationDocument.getChanges();
          return changesToStream(changes, lib);
        });

        stream.onValue(function() {
          lib.log.info('the configuration document changed on the database: reloading with new settings');
          lib.log.debug(JSON.stringify(arguments));
        });
        stream.onError(onError);

        return stream
          .toProperty()
          .startWith(firstConfigurationDocument);
      })();
      /* changes feeds are wrapped into `Bacon.repeat` in order to be
       * robust to network conditions with a small timeout */
      var changes = Bacon.repeat(function() {
        return changesToStream(withOptions.getChanges(), lib);
      });
      changes.onError(onError);
      // the configuration document is a property, while the changes
      // are a stream. whenever a change is detected, we want to use
      // the latest configuration document. this can be achieved with
      // `property.sampledBy(stream, f)`
      var changesAndConfigurations = configurationDocuments
            .sampledBy(changes, function(configurationDocument, change) {
              return {
                configurationDocument: configurationDocument,
                change: change
              };
            });
      // for every change event we create a stream of messages to be
      // sent, then all those streams are flatted together. since we
      // are generating streams from arrays, they will be closed
      // automatically
      var outgoing = changesAndConfigurations.flatMap(function(obj) {
        try {
          var outgoingArray = lib.dispatch(obj);
          return Bacon.fromArray(outgoingArray);
        } catch (error) {
          lib.captureError(error);
          return Bacon.never();
        }
      });

      outgoing.onValue(withOptions.sendToMobile);
      outgoing.onError(onError);

      // export for testing
      module.exports.changes = changes;
      module.exports.configurationDocuments = configurationDocuments;
      module.exports.changesAndConfigurations = changesAndConfigurations;
      module.exports.outgoing = outgoing;
    }, function() {
      withOptions.captureMessage('error fetching the configuration document', {
        extra: {'promise error': JSON.stringify(arguments) }
      });
    });
};
