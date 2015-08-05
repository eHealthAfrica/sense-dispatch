var command = require('sense-dispatch');

command({
  CONTACTS_DB_URL: process.env.DB_URL
});
