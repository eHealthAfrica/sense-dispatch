# Changelog

## 2.0.0 - upcoming
### Major
- `recipients` is not supported anymore, use `routing.defaults`
  instead. the recommended way to do the transition is write a
  `routing` property in your configuration documents before updating
  this component. After the update, `recipients` will be ignored
### Minor
- add cascading routing, see #23

## 1.3.0 - 11 September 2015
### Minor
- avoid reporting "Error: ESOCKETTIMEDOUT" to Sentry

## 1.2.0 - 10 September 2015
### Minor
- use a view which excludes notified documents from the changes feed

## 1.1.0 - 9 September 2015
### Minor
- add a check in order to prevent double notifications even in case of
  multiple services running concurrently and in case of change events
  triggered twice, closes #18

## 1.0.0 - 8 September 2015
### Minor
- keep track of the last sequence number, closes #12

I will tag this as the first major release, because i think that we
will go to production with this

## 0.3.0 - 7 September 2015
### Minor
- add timestamps to log lines

## 0.2.0 - 26 August 2015
### Minor
- add the `inlinePath` conf option in order to inline docs

## 0.1.0 - Summer 2015
### Breaking
- revamped and rewrote the whole projects in order to enable
  https://github.com/eHealthAfrica/sense-dashboard/issues/77

## 0.0.0 - Summer 2014
  - Initial project setup
