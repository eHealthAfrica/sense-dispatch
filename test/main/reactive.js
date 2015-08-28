describe('the reactive logic', function () {
  var Bacon = require('baconjs')
  var reactive, main
  beforeEach(function () {
    reactive = require('../../reactive')
    main = reactive.main
  })
  it('exports a main module object', function () {
    main.should.be.a('function')
  })
  describe('with a mocked library', function () {
    var sinon = require('sinon')
    var events = require('events')
    var Q, deferred, emitters, withOptions, lib
    beforeEach(function () {
      function constant (val) {
        return function () {
          return val
        }
      }
      Q = require('q')
      deferred = Q.defer()
      emitters = {
        configurationDocument: new events.EventEmitter(),
        changes: new events.EventEmitter()
      }
      withOptions = {
        configurationDocument: {
          getInitial: constant(deferred.promise),
          getChanges: constant(emitters.configurationDocument)
        },
        getChanges: constant(emitters.changes),
        inline: function (a) { return Q(a) },
        sendToMobile: sinon.spy(),
        captureError: sinon.spy()
      }
      // we need to do this before passing `withOptions` to `constant`
      sinon.spy(withOptions, 'getChanges')
      lib = {
        withOptions: constant(withOptions),
        dispatch: sinon.spy(function () { return [1, 2, 3] }),
        captureMessage: sinon.spy(),
        log: {
          info: function () {},
          debug: function () {}
        }
      }
    })
    afterEach(function () {
      assert(!lib.captureMessage.called, 'there are no errors catched')
    })
    it('waits the promise without throwing exceptions', function () {
      assert.doesNotThrow(function () {
        main({}, lib)
      })
    })
    it('is correctly spied', function () {
      assert(!withOptions.getChanges.called)
      lib.withOptions().getChanges()
      assert(withOptions.getChanges.called)
    })
    describe('with a document configuration', function () {
      beforeEach(function (done) {
        main({}, lib)
        deferred.resolve({conf: 'doc'})
        deferred.promise.finally(done)
      })
      it('got a first configuration document', function () {
        assert.deepEqual(reactive.firstConfigurationDocument, {conf: 'doc'})
      })
      it('has a conf object', function () {
        var spy = sinon.spy()
        reactive.configurationDocuments.onValue(spy)
        assert.deepEqual(spy.args[0], [{conf: 'doc'}])
      })
      it('asks for changes', function () {
        assert(withOptions.getChanges.called)
      })
      it('allows the configuration to be sampled', function () {
        var stream = Bacon.fromArray([1, 2, 3])
        var spy = sinon.spy()
        reactive.configurationDocuments.sampledBy(stream).onValue(spy)
        assert.equal(spy.args.length, 3)
      })
      describe('with a faulty `dispatch`, on a document change', function () {
        var error
        beforeEach(function (done) {
          error = new Error('dispatch error')
          lib.dispatch = function () { throw error }
          emitters.changes.emit('change', {})
          // there are some Q promises along the way, which would lead
          // to a failure if we evaluated this synchronously, so let
          // us take some time
          Q.delay(100).then(done)
        })
        it('is called', function () {
          assert(withOptions.captureError.called)
        })
        it('logs the error', function () {
          assert.deepEqual(withOptions.captureError.args, [[error]])
        })
      })
      describe('on a document change', function () {
        var hadListeners, changesSpy, changesAndConfigurationsSpy
        // This isn't used anywhere...
        // var change = {
        //   seq: 4961,
        //   id: 'some id',
        //   changes: [ {} ],
        //   doc: {
        //     _id: 'some id',
        //     _rev: '1-e95541d309722ef8626c9c992880e226',
        //     comment: '',
        //     appVersion: '4.1.0',
        //     dateOfVisit: '2015-06-30T11:30:29.273Z',
        //     deviceId: 'e1ecb015c869148b',
        //     symptoms: {},
        //     geoInfo: {},
        //     interviewer: [Object],
        //     personId: '214119b8-98fb-43ae-b317-aa00c3ae559c',
        //     doc_type: 'followup',
        //     version: '1.19.0'
        //   }
        // }
        beforeEach(function (done) {
          changesSpy = sinon.spy()
          changesAndConfigurationsSpy = sinon.spy()
          reactive.changes.onValue(changesSpy)
          reactive.changesAndConfigurations.onValue(changesAndConfigurationsSpy)
          hadListeners = emitters.changes.emit('change', {})
          // there are some Q promises along the way, which would lead
          // to a failure if we evaluated this synchronously, so let
          // us take some time
          Q.delay(100).then(done)
        })
        it('had listeners', function () {
          assert(hadListeners)
        })
        it('sent changes', function () {
          assert(changesSpy.called, 'called the changes spy')
        })
        it('sent changes and configuration', function () {
          assert(changesAndConfigurationsSpy.called, 'called the changes and configuration spy')
        })
        it('dispatches', function () {
          assert(lib.dispatch.called, 'called dispatch')
        })
        it('sends a message', function () {
          assert(withOptions.sendToMobile.called, 'called sendToMobile')
        })
      })
    })
  })
})
