#### How to test manually

I tried to have high unit test coverage on this project, anyway i also
used to test it manually often, in a very simple way. In order to test
quickly i used to connect it to the database and gateway at
development level, and i used the test version of the [Sense
Followup](github.com/eHealthAfrica/sense-followup) application to add
a new symptomatic followup to a fake Ebola contact i created.

This is how i started the script from the command line in order to
have it using services from the development environment:

    $ node sense-dispatch.js -b -g https://user:pass@dev-sl-ebola-cases.eocng.org/_couchdb/sense/_messages -d https://user:pass@dev-sl-ebola-cases.eocng.org/_couchdb/sense

This way, when adding a symptomatic followup, you should see log lines
about the messages being sent through the gateway, if the
configuration document is in the right way and well
configured. Obviously `user` and `pass` need to be replaced with
actual values.

It also happened to me that the connection to the changes feed timed
out shortly after some changes were detected, so i could also test
proper timeout handling.

If you have some doubts about the new documents being already in the
remote database, remember that you can query the filtering view
directly via Futon and see the last entries.

That's all, happy developing
