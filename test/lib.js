var PouchDB = require('pouchdb')
var databaseName = 'test-database'
describe('the library', function () {
  var lib = require('../lib')
  it('exports a main module object', function () {
    lib.should.exist
  })
  it('builds a withOptions object', function () {
    lib.withOptions({ database: databaseName }).should.exist
  })
  describe('dispatch', function () {
    it('dispatches', function () {
      var result = lib.dispatch({
        configurationDocument: {
          template: 'A new Ebola suspect was found, the id is ${ personId }',
          routing: {
            defaults: ['1234']
          }
        },
        change: {
          personId: 'a-b-c-d'
        }
      })
      assert.deepEqual(result, [{
        to: '1234',
        content: 'A new Ebola suspect was found, the id is a-b-c-d'
      }])
    })
    it('throws an error when a property is missing', function () {
      assert.throws(function () {
        lib.dispatch({
          configurationDocument: {
            template: 'A new Ebola suspect was found, the id is ${ persoId }',
            routing: { defaults: ['1234'] }
          },
          change: {
            personId: 'a-b-c-d'
          }
        })
      }, 'persoId is not defined')
    })
    it('ignores missing properties on the second level', function () {
      var result = lib.dispatch({
        configurationDocument: {
          template: 'A new Ebola suspect was found, the id is ${ one.two }',
          routing: { defaults: ['1234'] }
        },
        change: {
          one: {}
        }
      })
      assert.deepEqual(result, [{
        to: '1234',
        content: 'A new Ebola suspect was found, the id is '
      }])
    })
  })
  describe('withOptions', function () {
    var withOptions
    beforeEach(function () {
      withOptions = lib.withOptions({
        database: databaseName
      })
    })
    it('throws an error when the database is missing', function () {
      assert.throws(function () {
        lib.withOptions({})
      }, 'Pouch requires a database name')
    })
    it('returns an event emitter for database changes', function () {
      withOptions.followers.view().on.should.exist
    })
    it('returns an event emitter for configuration changes', function () {
      withOptions.followers.configuration().on.should.exist
    })
    describe('with a doc in the database', function () {
      // this extra step helped me to debug the way the test framework
      // works in relation with Pouch
      var id = 'id'
      var db
      var doc
      function setFixture () {
        doc = { _id: id }
        return db
          .get(id) // possibly written in previous runs
          .then(function (ret) {
            return db.remove(ret)
          }, function () { // not found, no need to remove it
            return
          })
          .then(function () {
            return db.post(doc)
          })
      }
      beforeEach(function (done) {
        db = new PouchDB(databaseName)
        db
          .then(function () {
            return setFixture()
          })
          .then(function () { done() })
          .catch(done)
      })
      it('can get the doc', function (done) {
        db.get(id).then(function () { done() })
      })
      it('can update the doc', function (done) {
        db
          .get(id)
          .then(function (doc) {
            return db.put(doc)
          })
          .then(function () { done() })
      })
      describe('markAsStarted', function () {
        var returned
        var obj
        beforeEach(function (done) {
          setFixture()
            .then(function () {
              return db.get(id)
            })
            .then(function (doc) {
              obj = {
                change: doc
              }
              return withOptions.markAsStarted(obj)
            })
            .then(function (_returned_) {
              returned = _returned_
            })
            .then(function () { done() })
        })
        it('returns the object as expected', function () {
          assert.deepEqual(returned, obj)
        })
        it('modifies the document as expected', function (done) {
          var expected = {
            _id: id,
            dispatcherNotification: {
              status: 'started'
            }
          }
          db
            .get(id)
            .then(function (returned) {
              try {
                delete returned._rev // this would be different
                assert.deepEqual(returned, expected)
                done()
              } catch (err) {
                done(err)
              }
            })
        })
      })
    })
  })
})
