var _ = require('lodash')

function extractorFactory (change) {
  return function (rule) {
    var value = _.get(change, rule.discriminator)
    return rule.cases[value] || []
  }
}

module.exports.extractorFactory = extractorFactory // expose for tests

module.exports.route = function (originalConf, change) {
  var defaultConf = { map: [] }
  var conf = _.merge(defaultConf, originalConf)
  var extractor = extractorFactory(change)
  function hasMatches (extracted) {
    return extracted.length
  }
  var matches = conf.map
        .map(extractor)
        .filter(hasMatches)
  if (matches.length) {
    return {
      description: 'there was a matching route',
      recipients: matches.shift()
    }
  } else {
    return {
      description: 'using default recipients',
      recipients: conf.defaults
    }
  }
}
