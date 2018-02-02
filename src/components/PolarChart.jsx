/*jshint node:true */
"use strict";

import React from 'react';
import * as d3 from 'd3';
import utils from './utils.js'
import Qty  from 'js-quantities';


const radToDeg = Qty.swiftConverter('rad', 'deg');
const msToKnC = Qty.swiftConverter('m/s', 'kn');
const knToMsC = Qty.swiftConverter('kn', 'm/s');


class PolarChart extends React.Component {

  constructor(props) {
    super(props);
    this.props = props;
    this.app = props.app;
    this.state = {
      headup: true,
      stw: 0,
      tws: 0,
      twa: 0,
      targetSpeed: 0,
      targetAngle: 0,
      maxStw: 0,
      scale: 0,
      polarCurve: []

    };


     var self = this;
    this.valueStreams = [
      {
        sourceId: this.app.sourceId,
        path: "navigation.headingMagnetic",
        update : (function(value) {
          self.update("hdm", radToDeg(value));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "performance.headingMagnetic",
        update : (function(value) {
          self.update("oppositeTackDirection", radToDeg(value));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "environment.wind.speedTrue",
        update : (function(value) {
          self.updateTws(msToKnC(value).toFixed(1));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "environment.wind.angleTrue",
        update : (function(value) {
          self.update("twa", radToDeg(value).toFixed(0));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "navigation.speedThroughWater",
        update : (function(value) {
          self.update("stw", msToKnC(value).toFixed(1));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "performance.targetSpeed",
        update : (function(value) {
          self.update("targetSpeed", msToKnC(value).toFixed(1));
        })
      },
      {
        sourceId: this.app.sourceId,
        path: "performance.targetAngle",
        update : (function(value) {
          self.update("targetAngle", radToDeg(value).toFixed(0));
        })
      },

    ];
  }


  componentDidMount() {
    utils.resolve(this.valueStreams, this.app.databus, this.app.sourceId);
    utils.subscribe( this.valueStreams, this);
  }

  componentWillUnmount() {
    utils.unsubscribe(this.valueStreams);
  }


  // state management ---------------------------------------------------------------------------------------------
  //
  update(key, value) {
    var newState = {};
    newState[key] = value;
    this.setState(newState);
  }

  zeroState() {
      this.setState({
          tws: 0.01,
          maxStw: 2,
          scale: 240/2,
          polarCurve: []
      });

  }

  updateTws(tws) {
    if ( tws < 0.01 ) {
      this.zeroState();
    } else {
      var polarCurve = this.app.calculations.polarPerformance.performanceForSpeed(knToMsC(tws));
      // polarCurve is [ { tws: < rad >, stw: <m/s>}]
      // needs to be [[x,y]]
      var plot = [];
      var maxStw = 0;
      for (var i = 0; i < polarCurve.length; i++) {
         polarCurve[i].stw = msToKnC(polarCurve[i].stw);
        if ( polarCurve[i].stw > maxStw ) {
          maxStw = polarCurve[i].stw;
        }
      }
      // make the max an even number.
      maxStw = (Math.floor(maxStw/2)+1)*2;
      // the outer ring is at 240 from the center.
      var scale = 240/maxStw;
      var a = [];
      for (var i = 0; i < polarCurve.length; i++) {
        a.push([polarCurve[i].twa, polarCurve[i].stw*scale]);
      };
      for (var i = polarCurve.length-1; i >= 0; i--) {
        a.push([(Math.PI*2)-polarCurve[i].twa, polarCurve[i].stw*scale]);
      };
      //console.log("Polar curve is ", maxStwn, scalen, polarCurve);
      //console.log("PolarLine is ",a);
      this.setState({
        tws: tws,
        maxStw: maxStw,
        scale: scale,
        polarCurve: a
      });
    }
  }

  getRoseRotation() {
    if (this.state.headup) {
      return 0;
    } else {
      return -this.state.hdm;
    }
  }


  generateRotation(angle) {
    if ( isNaN(angle) ) {
      console.log("Nan Angle");
      return 'rotate( 0 300 300 )';
    } else {
      return 'rotate( '+angle+' 300 300 )';        
    }
  } 

  // render ---------------------------------------------------------------------------------------------
  // bunch of constants first.

  render() {

    var self = this;

 
    const majorTicks = Array.from(new Array(17),(val,index)=>(index+1)*10).map((n) =>
          <path d="M 300 48 L 300 60 M 300 540 L 300 552" key={n}  strokeWidth="2" transform={self.generateRotation(n)} ></path>
    );
    const minorTicks = Array.from(new Array(18),(val,index)=>5+(index)*10).map((n) =>
          <path d="M 300 53 L 300 60 M 300 540 L 300 547"  key={n} strokeWidth="1" transform={self.generateRotation(n)} ></path>
    );
    const subMinorTicks = (function() {
      let op = [];
      for ( var i = 1; i < 180; i++) {
        if ( i%5 !== 0 ) {
          op.push((<path d="M 300 55 L 300 60 M 300 540 L 300 545"  key={i} strokeWidth="0.5" transform={self.generateRotation(i)} ></path>));
        }
      }
      return op;
    })();
    const majorNumberValues = [ 90, 180, 270 ];
    const majorNumberLabels = majorNumberValues.map((n) =>
          <text x="300" y="35" textAnchor="middle" key={n} style={{fontSize: '20px'}}  transform={self.generateRotation(n)} 
              >{"000".substr(n.toString().length)+n.toString()}</text>
    );
    const minorNumberLabels = (function() {
      var op = [];
      for ( var i = 1; i < 18; i++) {
          let n = i*10;
          let nstxt = n.toString();
          op.push((        
            <text x="300" y="45" textAnchor="middle" key={i} style={{fontSize: '15px'}}  transform={self.generateRotation(n)} 
            >{nstxt}</text>));
          op.push((
            <text x="300" y="45" textAnchor="middle" key={-i} style={{fontSize: '15px'}}  transform={self.generateRotation(-n)} 
            >{nstxt}</text>
            ));
      }
      op.push((
          <text x="300" y="45" textAnchor="middle" key={180} style={{fontSize: '15px'}}  transform={self.generateRotation(180)} 
          >180</text>
          ));
      return op;
    })();

    const radialLines = (function() {
      var lines = [];
      for (var i = 0; i < 180; i+= 10) {

          lines.push((<path d="M 300 60 L 300 290 M 300 310 L 300 540 "  key={i} strokeWidth="1" transform={self.generateRotation(i)} ></path>));
      };
      return lines;
    })();


    const createRoseMarker = function(id) {
      return (
        <g transform="translate(0,-85)" >
            <circle cx="300" cy="100" r="15" strokeWidth="0"  ></circle>
            <polygon points="285,103 300,135 315,103" strokeWidth="0"  ></polygon>
            <circle cx="300" cy="100" r="11" className="light-area" stroke="#333" strokeWidth="0"  ></circle>
            <text x="300" y="106" textAnchor="middle" className="light-area" style={{fontSize: '20px'}} >{id}</text>
        </g> 
      );
    }

    const groundWindRoseMarker = createRoseMarker('G');
    const oppositeTackDirectionMarker = createRoseMarker('0');





    return (
    <g  transform={this.generateRotation(this.getRoseRotation())} >
        {majorTicks}
        {minorTicks}
        {minorNumberLabels}
        {radialLines}
        {this.generateCircular()}
        {this.generatePolarLine()}
        {this.drawWindAngles()}
    </g>
  );
  }


  // Generators, dynamic markup ----------------------------------------------------------------------------------------------
  generateCircular() {
    var circles = [];
    var step = 2;
    if ( this.state.maxStw < 5 ) {
      step = 1;
    }
    for (var i = 0; i <= this.state.maxStw; i+= step) {
        var radius = this.state.scale * i;
        var textPos = 300-radius;
        circles.push((<circle cx="300" cy="300"  r={radius} key={i} fill="none"  ></circle>));
        circles.push((<text x="300" y={textPos} key={-(i+1)} textAnchor="middle" className="light-area" style={{fontSize: '20px'}} >{i}</text>));
    };
    return circles;
  }

  drawWindAngles() {
    // target wind and target speed line.
    // current wind and current speed line
    var boatSpeedMarker = (300-this.state.stw*this.state.scale);
    var tagetSpeedMarker = (300-this.state.targetSpeed*this.state.scale);
    var boatSpeedLine =  "M 300 300 L 300 "+boatSpeedMarker;
    var targetSpeedLine = "M 300 300 L 300 "+tagetSpeedMarker;
    return [
        (
          <g transform={this.generateRotation(this.state.twa) } key="boat" className="true-wind-marker"  >
            <path d={boatSpeedLine} className="true-wind-history" ></path>
            <circle cx="300" cy={boatSpeedMarker} r="5" ></circle>
          </g>
        ),(
          <g transform={this.generateRotation(this.state.targetAngle) } key="target" >
            <path d={targetSpeedLine} ></path>
            <circle cx="300" cy={tagetSpeedMarker} r="5" ></circle>
          </g>
        )
        ];
  }


  generatePolarLine() {
    const radialLine = d3.radialLine().curve(d3.curveBasis);
    return (
        <g transform="translate(300,300)">
          <path d={radialLine(this.state.polarCurve)} className="true-wind-history"  ></path>
        </g>
        );
  } 


}

export default PolarChart;