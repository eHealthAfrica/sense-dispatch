/* i have to admit that i had to create test cases in order to be
 * absolutely sure how my libraries worked */
var sinon = require('sinon'),
    Q = require('q'),
    Bacon = require('baconjs');
describe('sampledBy', function() {
  var stream, property;
  beforeEach(function() {
    stream = Bacon.fromArray([1, 2, 3]);
    property = Bacon.constant('value');
  });
  it('does not output values without an initial property value', function() {
    var spy = sinon.spy();
    property = Bacon.fromPromise(Q.defer().promise);
    property.sampledBy(stream).onValue(spy);
    assert(!spy.called);
  });
  it('output values with a constant property', function() {
    var spy = sinon.spy(function(a, b) {
      return a + ' ' + b;
    });
    property = Bacon.constant('p');
    property
      .sampledBy(stream, spy)
      .onValue(function() {}); // just in order to flush the streams
    assert.deepEqual(spy.returnValues, [
      "p 1",
      "p 2",
      "p 3"
    ]);
  });
  it('does not outputs values if the promise is resolved late', function() {
    var spy = sinon.spy(),
        deferred = Q.defer();
    property = Bacon.fromPromise(deferred.promise);
    property.sampledBy(stream).onValue(spy);
    deferred.resolve('p');
    assert.deepEqual(spy.returnValues, []);
  });
  it('outputs when an initial property value is given', function() {
    var spy = sinon.spy(function(a, b) {
      return a + ' ' + b;
    });
    property = Bacon.fromArray([]).toProperty().startWith('p');
    property
      .sampledBy(stream, spy)
      .onValue(function() {}); // just in order to flush the streams
    assert.deepEqual(spy.returnValues, [
      "p 1",
      "p 2",
      "p 3"
    ]);
  });
  it('gives us the initial property value', function() {
    var spy = sinon.spy();
    property = Bacon.fromArray([]).toProperty().startWith('p');
    property.onValue(spy);
    assert.deepEqual(spy.args[0], ['p']);
  });
  it('samples also without a combining function', function() {
    var spy = sinon.spy();
    property = Bacon.fromArray([]).toProperty().startWith('p');
    property.sampledBy(stream).onValue(spy);
    assert.deepEqual(spy.args.length, 3);
  });
  it('picks the last property value available', function() {
    var spy = sinon.spy(function(a, b) {
      return a + ' ' + b;
    });
    property = Bacon.fromArray(['p2','p3']).toProperty().startWith('p1');
    property
      .sampledBy(stream, spy)
      .onValue(function() {}); // just in order to flush the streams
    assert.deepEqual(spy.returnValues, [
      "p3 1",
      "p3 2",
      "p3 3"
    ]);
  });
});
describe('flatMap', function() {
  it('concatenates results as expected', function() {
    var stream = Bacon.fromArray(['a', 'b']);
    var spy = sinon.spy();
    stream
      .flatMap(function(letter) {
        var array = [1, 2].map(function(number) {
          return letter + ' ' + number;
        });
        return Bacon.fromArray(array);
      })
      .onValue(spy);
    assert.deepEqual(spy.args, [
      ['a 1'],
      ['a 2'],
      ['b 1'],
      ['b 2']
    ]);
  });
});
describe('testing a deferred', function() {
  it('does not work as i initially expected', function() {
    var spy = sinon.spy();
    var deferred = Q.defer();
    deferred.promise.then(spy);
    deferred.resolve('value');
    assert(deferred.promise.isFulfilled());
    assert(!spy.called);
  });
  it('needs to be done, for example, this way', function(done) {
    var spy = sinon.spy();
    var deferred = Q.defer();
    deferred.promise
      .then(spy)
      .then(function() {
        assert(spy.calledWith('value'));
      })
      .then(done);
    deferred.resolve('value');
  });
});
describe('event emitters', function() {
  var events = require('events'),
      emitter,
      spy;
  beforeEach(function() {
    emitter = new events.EventEmitter();
    spy = sinon.spy();
    emitter.on('event', spy);
    emitter.emit('event');
  });
  it('evaluate synchronously, no need to use `done` with Mocha', function() {
    assert(spy.called);
  });
});
