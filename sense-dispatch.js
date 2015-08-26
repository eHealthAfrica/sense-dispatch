#!/usr/bin/env node

var yargs = require('yargs'),
    reactive = require('./reactive');

var options = yargs
      .version('0.2.0')
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
        }
      })
      .argv;

reactive.main(options);
