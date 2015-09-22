var router = require('../router')
var route = router.route
var conf
var event
describe('the route function', function () {
  describe('if defaults are defined', function () {
    beforeEach(function () {
      event = {
        key: 'missing'
      }
      conf = {
        map: [{
          discriminator: 'key',
          cases: {
            matching: ['789']
          }
        }],
        defaults: ['123', '456']
      }
    })
    describe('and no map is defined', function () {
      beforeEach(function () {
        delete conf.map
      })
      it('just points to the recipients', function () {
        expect(route(conf, event).recipients).to.deep.equal(['123', '456'])
      })
    })
    describe('and a map is also defined', function () {
      it('uses defaults just as a final fallback', function () {
        expect(route(conf, event).recipients).to.deep.equal(['123', '456'])
      })
      it('uses the map if there is a match', function () {
        event.key = 'matching'
        expect(route(conf, event).recipients).to.deep.equal(['789'])
      })
    })
  })
  describe('with a route map array', function () {
    beforeEach(function () {
      event = {
        first: 'matching',
        second: 'matching'
      }
      conf = {
        map: [{
          discriminator: 'first',
          cases: {
            matching: ['123']
          }
        }, {
          discriminator: 'second',
          cases: {
            matching: ['456']
          }
        }],
        defaults: ['789']
      }
    })
    describe('when the first rule matches', function () {
      it('gets the first recipients', function () {
        expect(route(conf, event).recipients).to.deep.equal(['123'])
      })
    })
    describe('when the first association fails', function () {
      beforeEach(function () {
        event.first = 'missing'
      })
      it('applies the second association', function () {
        expect(route(conf, event).recipients).to.deep.equal(['456'])
      })
    })
  })
})
describe('the extractor factory', function () {
  var extractorFactory
  beforeEach(function () {
    extractorFactory = router.extractorFactory
  })
  describe('the produced extractor', function () {
    var extractor
    beforeEach(function () {
      extractor = extractorFactory({
        key: 'value',
        numericKey: 42
      })
    })
    it('extracts the recipients if an event matches a rule', function () {
      var rule = {
        discriminator: 'key',
        cases: {
          'value': [1, 2, 3]
        }
      }
      expect(extractor(rule)).to.deep.equal([1, 2, 3])
    })
    it('returns an empty set if the rule does not match ', function () {
      var rule = {
        discriminator: 'key',
        cases: {
          'missing': [1, 2, 3]
        }
      }
      expect(extractor(rule)).to.deep.equal([])
    })
    it('converts to string before matching', function () {
      // this is necessary because object properties have to be strings
      var rule = {
        discriminator: 'numericKey',
        cases: {
          '42': [1, 2, 3]
        }
      }
      expect(extractor(rule)).to.deep.equal([1, 2, 3])
    })
  })
})
