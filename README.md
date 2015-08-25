[![NPM version](https://badge.fury.io/js/sense-dispatch.png)](http://badge.fury.io/js/sense-dispatch)
[![Build Status](https://travis-ci.org/eHealthAfrica/sense-dispatch.png?branch=master)](https://travis-ci.org/eHealthAfrica/sense-dispatch)
[![Dependency Status](https://david-dm.org/eHealthAfrica/sense-dispatch.png)](https://david-dm.org/eHealthAfrica/sense-dispatch)

# Sense Dispatch

Messaging service for eHealth Sense app

# Design

The service will get a few configuration options from the command
line, and the others from a configuration document stored in the Sense
database. This way, users will be enabled to customise the alerts. The
configuration document has id `sense-dispatch-configuration`.

Considering that the following parameters are set on the configuration
document:

- filtering view
- message template
- recipients

The service works as follows:

- waits for a new document to pass the filtering view
- fills the document in the template
- sends the message to the recipients

This streamlined control flow has the implication that a message can
be sent just when a new document is created. At the moment, the
control flow does not support notifications about a *change* in an
existing document.

### Command line use

An example use is:

    sense-dispatch-2.js -b -g https://user:pass@dev-sl-ebola-cases.eocng.org/_couchdb/sense/_messages -d https://user:pass@dev-sl-ebola-cases.eocng.org/_couchdb/sense

Note that `-b` activates extra debugging info and can be omitted.

An important part of the configuration will be fetched from the
database, in the document with id `sense-dispatch-configuration`. This
will be automatically reloaded when changed. See the directory
`configuration-examples` here in order to see how to structure the
document.

#### What about the 2?

I was working on this project after one year of inactivity, and for a
different use case. New functionalities i needed were all easier to
write from scratch, but i can't exclude that we might want to use the
preexisting logic, so i created some new files marked with `2`, namely
a new library, `lib2` and a new executable,
`sense-dispatch-2`. Eventually this duplication could be eliminated.

Information in this README refer to version 2. As far as i understand,
the goal of the former version was to send messages *and* emails upon
some events. When we started working on this again, we did not need
emails, and we needed to communicate with a different service for
sending messages. The service used in `lib2.js` for sending messages
is the [Telerivet
Gateway](https://github.com/eHealthAfrica/telerivet-gateway), while i
am not sure about which service is used in `lib.js`
