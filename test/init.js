var path = require('path')
var chai = require('chai')

global.assert = chai.assert
global.expect = chai.expect
chai.should()

;(function () {
  // this part is related to coverage. in the past i experienced that
  // coverage reports might suppress some exceptions, so i want to
  // disable this once in a while, just in order to be sure that there
  // are no exceptions that i am missing
  var coverage = true
  if (coverage) {
    var istanbul = require('istanbul')
    var hook = istanbul.hook
    var Instrumenter = istanbul.Instrumenter
    var instrumenter = new Instrumenter()
    var cwd = process.cwd()
    var cwdNodeModules = path.resolve(cwd, 'node_modules')
    var cwdTest = path.resolve(cwd, 'test')
    var matcher = function (file) {
      if (file.indexOf(cwd) !== 0 || file.indexOf(cwdNodeModules) === 0 || file.indexOf(cwdTest) === 0) {
        return false
      }
      return true
    }
    var transformer = instrumenter.instrumentSync.bind(instrumenter)
    hook.hookRequire(matcher, transformer)
  }
})()
