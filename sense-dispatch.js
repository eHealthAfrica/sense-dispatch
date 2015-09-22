#!/usr/bin/env node

var yargs = require('yargs')
var reactive = require('./reactive')

var options = yargs
  .version('1.3.0')
  .usage('Usage: $0 -d <database location> -g <gateway location>')
  .options({
    'd': {
      alias: 'database',
      demand: true,
      describe: 'The location of the database to be watched'
    },
    'g': {
      alias: 'gateway',
      demand: true,
      describe: 'The location of your Telerivet Gateway'
    },
    'b': {
      alias: 'debug',
      describe: 'Add extra log message for debugging'
    },
    's': {
      alias: 'sentry',
      describe: 'Enable Sentry reporting',
      default: true
    }
  })
  .argv

reactive.main(options)
