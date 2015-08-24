#!/usr/bin/env node
var command = require('lib');

command({
  CONTACTS_DB_URL: process.env.DB_URL
});
