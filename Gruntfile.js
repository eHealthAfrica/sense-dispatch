var fs = require('fs')
var cp = require('child_process')
var rimraf = require('rimraf')
var istanbul = require('istanbul')

var LINT = true
var COVERALLS = false

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    mochaTest: {
      lib: {
        options: {
          ui: 'bdd',
          require: ['test/init.js']
        },
        src: ['test/**/*.js', '!test/init.js', '!test/_fixtures/**']
      }
    }
  })

  grunt.loadNpmTasks('grunt-mocha-test')

  grunt.registerTask('test', 'Build, generate coverage, run tests.', function () {
    if (fs.existsSync('test-results')) {
      rimraf.sync('test-results')
    }
    fs.mkdirSync('test-results')

    process.env.multi = 'spec=- mocha-slow-reporter=test-results/slow.txt'
    grunt.config.set('mochaTest.lib.options.reporter', 'mocha-multi')

    // needed so that mocha-multi doesn't kill the process
    var program = require('mocha/node_modules/commander')
    program.name = 'mocha'
    program.exit = false

    grunt.task.run(['build', 'mochaTest', 'covreport'])
    if (process.env.TRAVIS) {
      grunt.config.set('mochaTest.lib.options.reporter', 'mocha-unfunk-reporter')
      if (COVERALLS) {
        grunt.task.run(['coveralls'])
      }
    }
  })

  grunt.registerTask('covreport', 'Generate coverage reports.', function () {
    var collector = new istanbul.Collector()
    collector.add(global.__coverage__)
    var reports = [
      istanbul.Report.create('lcovonly', { dir: 'test-results' })
    ]
    if (process.env.TRAVIS) {
      // show per-file coverage stats in the Travis console
      reports.push(istanbul.Report.create('text'))
    } else {
      // produce HTML when not running under Travis
      reports.push(istanbul.Report.create('html', { dir: 'test-results' }))
    }
    reports.push(istanbul.Report.create('text-summary'))
    reports.forEach(function (report) {
      report.writeReport(collector, true)
    })
  })

  grunt.registerTask('coveralls', 'Push to Coveralls.', function () {
    this.requires('mochaTest')
    var done = this.async()
    cp.exec('cat ./test-results/lcov.info | ./node_modules/.bin/coveralls', { cwd: './' }, function (err, stdout, stderr) {
      grunt.log.writeln(stdout + stderr)
      done(err)
    })
  })

  grunt.registerTask('build', function () {
    if (LINT) {
    }
  })

  grunt.registerTask('default', ['build'])
}
