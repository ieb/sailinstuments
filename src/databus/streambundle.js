/*jshint node:true */
"use strict";

/*

StreamBundle is a "bundle of streams": Bacon.js streams, two
for each Signal K (source, path) combination. You can get a stream
for the raw data with getBusForSourcePath and a stream where data
is debounced (200 ms) and some units converted with
getStreamForSourcePath.

All incoming Signal K deltas should be passed in via handleDelta.

In addition to the individual streams StreamBundle provides a
stream that contains notifications of new (source, path)
combinations appearing in the incoming data. The data in
that stream contains {sourceId, path, key, stream} objects.
InstrumentPanel discovers new data items by listening to this
stream.

Key is a 'standard' single string representation  of source id
and path produced with signalkSchema.keyForSourceIdPath.

There is a _preferred sourceId that contains values from a stream in preferred order
with a idle timeout of 30s.

ie, if you getBusForSourcePath or getStreamForSourcePath you will get exatly the sourceID sourcePath 
asked for.

The incomming datastream gets pushed to 
the exact Bus
the _preferred Bus if the incomming stream is the highest priority source
the allSources Bus

If you want to subscribe to a spedific source, use the sourceID
If you want to subscribe to a path from any source, use _preferred as a sourceId
If you want to subscribe to all changes and decide for yourself, then use allSources and inspect
the updates.

*/


const Bacon = require('baconjs');
const Qty = require('js-quantities');
const signalkSchema = require('@signalk/signalk-schema');
const _ = require("lodash");

const vesselSchema = require('@signalk/signalk-schema/schemas/vessel');
var signalkMainPaths = {};
for(var prop in vesselSchema.properties) {
  if(typeof vesselSchema.properties[prop] === 'object') {
    signalkMainPaths[prop] = true;
  }
}

var conversions = {
  "rad": Qty.swiftConverter('rad', 'deg')
}

function StreamBundle(props) {
  this.buses = {}; // the raw buses
  this.streams = {}; // a stream object that provides a debounced object.
  this.sourceIdPreferences = []; // set this to change the priorities.
  this.pathValues = new Bacon.Bus();
  this.allSources = new Bacon.Bus();

  this.updateConfig = this.updateConfig.bind(this);
  props.configStream.onValue(this.updateConfig);
}

StreamBundle.prototype.updateConfig = function(config) {
  console.info("Got new Config ", config);
  if ( config.sourceIdPreferences !== undefined ) {
    this.sourceIdPreferences = _.clone(config.sourceIdPreferences);
  } else {
    this.sourceIdPreferences = [];
  }
}

StreamBundle.prototype.handleDelta = function(delta) {
  var that = this;
  if(delta.updates) {
    delta.updates.forEach(function(update) {
      var sourceId = signalkSchema.getSourceId(update.source).split('.')[0];
      update.values.forEach(function(pathValue) {
        if(pathValue.path) {
          if(signalkMainPaths[pathValue.path.split('.')[0]]) {
            that.push(sourceId, pathValue)
          }
        }
      });
    });
  }
}

StreamBundle.prototype.push = function(sourceId, pathValue) {
  pathValue.sourceId = sourceId;

  this.pathValues.push(pathValue);

  this.getBusForSourcePath(sourceId, pathValue.path).push(pathValue.value);

  // also push the value onto the preferred bus, if this sourceId is currently perfered.
  
  var autoBus = this.getBusForAutoPath(sourceId, pathValue.path);
  if ( autoBus !== undefined ) {
//    console.log("Delivering ",pathValue.path," from ",sourceId," to _preferred");
    autoBus.push(pathValue.value);
  }
  
  var key = signalkSchema.keyForSourceIdPath(sourceId, pathValue.path);
  //  console.log("Updating ", sourceId, pathValue.path, pathValue.value );
  this.allSources.push({
    sourceId: sourceId,
    path: pathValue.path,
    key: key,
    stream: this.getStreamForSourcePath(sourceId, pathValue.path)
  });
}

StreamBundle.prototype.getSourcePreference = function(sourceId) {
  var i = this.sourceIdPreferences.indexOf(sourceId);
  if ( i == -1 ) {
    i = 1000;
  }
  return i;
}


/**
 * this gets the preferred bus for the path, but only if the
 * supplied sourceId is the same, or of a higher proprity.
 */
StreamBundle.prototype.getBusForAutoPath = function(sourceId, path) {
  var chosenBus = undefined;
  var bus = this.getBusForSourcePath("_preferred", path);
  var now = Date.now();
  if ( bus.lockedSourceId ===  undefined ) {
    chosenBus = bus;
  } else if (this.getSourcePreference(sourceId) < this.getSourcePreference(bus.lockedSourceId)) {
    // higher priority sourceId, lock it
    chosenBus = bus;
  } else if ( bus.lockedSourceId === sourceId ) {
    chosenBus = bus;
  } else if (now > bus.lockedSourceExpires ) {
    chosenBus = bus;
  }
  if (chosenBus !== undefined) {
    // bus is not locked, so lock it.
    chosenBus.lockedSourceId = sourceId;
    chosenBus.lockedSourceExpires = now + 30000;

  }

  return chosenBus;
}

StreamBundle.prototype.getBusForSourcePath = function(sourceId, path) {
  var key = signalkSchema.keyForSourceIdPath(sourceId, path);
  var result = this.buses[key];
  if(!result) {
    console.debug("New Bus for ", { key: key, sourceId:sourceId, path:path});
    result = this.buses[key] = new Bacon.Bus();
 //   result.sourceId = sourceId;
//    result.path = path;
  }
  return result;
}


StreamBundle.prototype.getStreamForSourcePath = function(sourceId, path) {
  var key = signalkSchema.keyForSourceIdPath(sourceId, path);
  var result = this.streams[key];
  if(!result) {
    console.debug("New Stream for ", { key: key, sourceId:sourceId, path:path});
    var bus = this.getBusForSourcePath(sourceId, path);
    result = bus.debounceImmediate(200);
    result = this.streams[key] = result.toProperty();
  }
  return result;
}


module.exports = StreamBundle;
