const {performance, PerformanceObserver} = require('perf_hooks');
const io = require('./server/socket.js');
const mod = require('module');
const path = require('path');

let deps;
const aggregate = {};
// let hierarchyAggregate;
let clientPath;

// io.on('connection', (socket) => {
//   process._rawDebug('socket id:', socket.id);
//   io.emit('packageInfo',hierarchyAggregate );
// });

// process._rawDebug('packageInfo');
// io.emit('packageInfo', );

performance.maxEntries = process.env.pacmonMaxEntries || 1500
mod.Module.prototype.require = performance.timerify(mod.Module.prototype.require);
require = performance.timerify(require);

const obs = new PerformanceObserver((list, observer) => {
  const entries = list.getEntries();
  // console.log(entries);
  let buffer;
  entries.forEach((entry, i) => {
    // console.log(entry);
  	if (aggregate[entry[0]]) {
  		aggregate[entry[0]] = [];
  		buffer = aggregate[entry[0]];
  		endTime = entry.startTime + entry.duration;
  		buffer.push({
  			name: entry[0],
  			startTime: entry.startTime,
  			duration: entry.duration,
  			endTime: endTime,
  			totalTime: entry.duration,
  			children: []
  		})
  	} else if (!entry[0].includes('package.json')) {
      // console.log(buffer)
  		buffer[0].totalTime += entry.duration
  		endTime = entry.startTime + entry.duration
  		buffer.push({
  			name: entry[0],
  			startTime: entry.startTime,
  			duration: entry.duration,
  			endTime: endTime,
  			totalTime: entry.duration,
  			children: null
  		})
  	}
  });
  io._hierarchyAggregate = createHierarchy(aggregate)
  obs.disconnect();
  performance.clearFunctions();
});

obs.observe({ entryTypes: ['function'], buffered: true });

function pkgMonitor(pkgPath) {
  clientPath = pkgPath.slice(0, pkgPath.length - 13);
  deps = require(pkgPath).dependencies;
  module.paths[0] = `${clientPath}/node_modules`;
  for(let i in deps){
  	aggregate[i] = true
  }
  gatherAggregate();
}

function gatherAggregate(){
	for(let i in deps){
		require(`${i}`);
	}
}

function createHierarchy(data){
	const d3Data = {name: 'root', children: []};
	let hierarchy = {};
	let stack = [];
	for (let i in data) {
		hierarchy[i] = {
			name: i,
			startTime: data[i][0].startTime,
			duration: data[i][0].duration,
			totalTime: data[i][0].totalTime,
			endTime: data[i][0].endTime,
			children: []
		};

		for (let j = 1; j < data[i].length; j++) {
		  if (stack.length === 0) {
		    stack.push(data[i][j]);
		    j++;
		  }

			let currParent = stack[stack.length - 1]
			if (data[i][j] && data[i][j].startTime >= currParent.startTime &&
				data[i][j].endTime < currParent.endTime) {
				stack.push(data[i][j]);
			} else {
			  const temp = stack.pop();
			  if (stack.length > 0) {
			  	if (stack[stack.length - 1].children === null) {
			  		stack[stack.length - 1].children = [];
			  	}
			  	stack[stack.length - 1].children.push(temp);
			  } else {
			  	hierarchy[i].children.push(temp);
			  }
			  stack.push(data[i][j]);
			}
		}

		checkStack(stack, hierarchy[i])
		d3Data.children.push(hierarchy[i])
	}
	return d3Data
}

function checkStack(stack, currHierarchy){
	while (stack.length !== 0) {
	  if (stack.length === 1) {
	  	let temp = stack.pop();
	  	if (!temp) break;
	  	else currHierarchy.children.push(temp);
	  } else {
	    let temp = stack.pop();
	    for (let k = stack.length - 1; k >= 0; k--) {
	      if (temp !== null && temp.startTime >= stack[k].startTime && temp.endTime < stack[k].endTime) {
	      	if(stack[k].children === null) {
	      		stack[k].children = [];
	      	}
	        stack[k].children.push(temp);
	        stack[k].totalTime += temp.totalTime;
	        temp = undefined;
	        break;
	      }
	    }
	    if (temp) currHierarchy.children.push(temp);
	  }
	}
}



module.exports = {pkgMonitor};