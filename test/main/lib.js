describe('the second library', function() {
  var lib = require('../../lib');
  it('exports a main module object', function() {
    lib.should.exist;
  });
  it('builds a withOptions object', function() {
    lib.withOptions({ database:'test' }).should.exist;
  });
  describe('dispatch', function() {
    it('dispatches', function() {
      var result = lib.dispatch({
        configurationDocument: {
          template: 'A new Ebola suspect was found, the id is ${ personId }',
          recipients: ['1234']
        },
        change: {
          personId: 'a-b-c-d'
        }
      });
      assert.deepEqual(result, [{
        to: '1234',
        content: 'A new Ebola suspect was found, the id is a-b-c-d'
      }]);
    });
    it('throws an error when a property is missing', function() {
      assert.throws(function() {
        var result = lib.dispatch({
          configurationDocument: {
            template: 'A new Ebola suspect was found, the id is ${ persoId }',
            recipients: ['1234']
          },
          change: {
            personId: 'a-b-c-d'
          }
        });
      }, 'persoId is not defined');
    });
    it('ignores missing properties on the second level', function() {
      var result = lib.dispatch({
        configurationDocument: {
          template: 'A new Ebola suspect was found, the id is ${ one.two }',
          recipients: ['1234']
        },
        change: {
          one: {}
        }
      });
      assert.deepEqual(result, [{
        to: '1234',
        content: 'A new Ebola suspect was found, the id is '
      }]);
    });
  });
  describe('withOptions', function() {
    var withOptions;
    beforeEach(function() {
      withOptions = lib.withOptions({
        database: 'test'
      });
    });
    it('throws an error when the database is missing', function() {
      assert.throws(function() {
        lib.withOptions({});
      }, 'Pouch requires a database name');
    });
    it('returns an event emitter for database changes', function() {
      withOptions.getChanges().on.should.exist;
    });
    it('returns an event emitter for configuration changes', function() {
      withOptions.configurationDocument.getChanges().on.should.exist;
    });
  });
});
