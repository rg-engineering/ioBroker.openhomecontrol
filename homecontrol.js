/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('homecontrol');

var objects = {};
var metaRoles = {};

var myPort = null;
var receivedData = "";

try {
    var SerialPort = require('serialport');
} catch (e) {
    console.warn('Serial port is not installed [' + e + ']');
}


//Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
	if (obj) {
        switch (obj.command) {
        	case 'send':
        		// e.g. send email or pushover or whatever
        		console.log('send command');

        		// Send response in callback if required
        		if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        		break;
        	case 'listUart':
        		//cmd comes typically from adpater settings page
                if (obj.callback) {
                    if (SerialPort) {
                        // read all found serial ports
                    	SerialPort.list(function (err, ports) {
                            adapter.log.info('List of port: ' + JSON.stringify(ports));
                            adapter.sendTo(obj.from, obj.command, ports, obj.callback);
                        });
                    } else {
                        adapter.log.warn('Module serialport is not available');
                        adapter.sendTo(obj.from, obj.command, [{comName: 'Not available'}], obj.callback);
                    }
                }
                break;
    	}
    }
});

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    }
    catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));

    //feuert auch, wenn adapter im admin anghalten oder gestartet wird...

    if (obj == null && myPort != null) {
        myPort.close();
    }

});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});



// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    try {
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready [' + e + ']');
    }
});

function main() {
    var options = {
        //serialport: adapter.config.serialport || '/dev/ttyACM0',
        serialport: adapter.config.serialport || 'COM13',
        baudrate: parseInt(adapter.config.baudrate) || 115200,
        device: adapter.config.device || "HomeControl"
    };

    SerialPort.list(function (err, ports) {
        ports.forEach(function (port) {
            adapter.log.info(port.comName + ' ' + port.pnpId + ' ' + port.manufacturer);
        });
    });


    //Rechte im Linux gesetzt??? 
    try {
        myPort = new SerialPort(options.serialport, {
            baudRate: options.baudrate
        });

    } catch (e) {
        adapter.log.error('Serial port is not created [' + e + ']');
    }

    /*
    adapter.objects.getObject('homecontrol.meta.roles', function (err, res) {
        metaRoles = res.native;
        adapter.objects.getObjectView('homecontrol', 'devices', function (err, res) {
            for (var i = 0, l = res.total_rows; i < l; i++) {
                objects[res.rows[i].id] = res.rows[i].value;
            }
        });
    */

    adapter.log.info('port created; portname: ' + options.serialport + ' ' + myPort.comName + ' ' + myPort.pnpId + ' ' + myPort.manufacturer + ' Data rate: ' + myPort.options.baudRate + ' ' + options.baudrate);

    myPort.on('open', showPortOpen);
    myPort.on('data', sendSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);

    if (adapter.config.device == "CUL") {
        adapter.log.info("CUL used");
    }
    else if (adapter.config.device == "HomeControl") {
        adapter.log.info("HomeControl used");
    }
    else {
        adapter.log.info("unknown device");
    }



    //test only =====================================================
    /*   adapter.delObject("CE1283180000",function (err, obj) {
           if (err) {
               adapter.log.error(err);
               return -1;
           }
           else
           {
               adapter.log.info("object deleted");
           }
       }
       
               );
               */
    //until here =====================================================

}


function showPortOpen() {
	
	try{
		if (myPort != null) {
			adapter.log.info('port open: ' + myPort.options.baudRate + ' ' + myPort.comName);
			if (adapter.config.device=="CUL"){
				//to enable homecontrol mode on CUL
				myPort.write("V\n\r");
				myPort.write("hr\n\r");
			}
		}
	}

    catch (e) {
        adapter.log.error('exception in  showPortOpen [' + e + ']');
    }
}


function insertObjects(objs) {
    if (objs.length < 1) {
        return;
    } else {
        var newObject = objs.pop();
        adapter.setObject(newObject._id, newObject, function (err, res) {
            adapter.log.debug('object ' + adapter.namespace + '.' + newObject._id + ' created');
            setTimeout(insertObjects, 0, objs);
        });
    }
}


function sendSerialData(data) {
    data = data.toString();

    if (data.length < 2) {
        return;
    }

    receivedData = receivedData + data;

    adapter.log.info(receivedData);

    if (adapter.config.device == "CUL") {

        try {
            //.contains geht unter linux nicht; unter win schon ???
            if (receivedData.indexOf("receive off") > 0) {
                adapter.log.info('port reopen. ');

                myPort.write("V\n\r");
                myPort.write("hr\n\r");
                receivedData = "";
                return;
            }

            if (data.indexOf("receive on") > 0) {

                receivedData = "";
                return;
            }

            if (receivedData.indexOf("HC-culfw Build") > 0) {

                receivedData = "";
                return;
            }
        }
        catch (e) {
            adapter.log.error('exception in  sendSerialData 4 [' + e + ']');
        }
    }
    else if (adapter.config.device == "HomeControl") {
        // filter out everyting not needed...
        // if got data not in then drop message
        if (receivedData.indexOf("data from") <= 0) {

            receivedData = "";
            return;
        }

    }


    //got data from Sensor :3FAF82180000 with 2 DP as broadcast Temp 30.64 C Press 958.32 mBar
    try {
        var res = receivedData.split(" ");
        var id = res[4].substr(0);

        if (id == "FFFFFFFFFFFF") {
            return;
        }
        var type = res[3].substr(0);
        var datapoints = 0;
        if (adapter.config.device == "CUL") {
            datapoints = parseInt(res[7].substr(0));
        }
        else if (adapter.config.device == "HomeControl") {
            datapoints = parseInt(res[8].substr(0));
        }

        adapter.log.info("from " + id + " with " + datapoints);

        //adapter.log.info("split size " + res.length);

        //CUL
        //got data from Sensor :CE1283180000 with 1 DP as broadcast Bright 0 lux
        //got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.80 C Hum 57.50 %
        //got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.67 C Press 962.35 mBar 
        //got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.66 C Press 962.33 mBar 
        //   
        //HomeControl
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31 
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.03 C Press 959.00 mBar
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.93 C Press 958.94 mBar
        //got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 29.00 lux
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.80 C Hum 38.30 %
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.98 C Press 958.88 mBar
        //got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 28.00 lux
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.80 C Hum 38.30 %
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.00 C Press 958.85 mBar
        //got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 28.00 lux
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.80 C Hum 38.40 %
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.02 C Press 958.94 mBar
        //got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 29.00 lux
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.30 C Hum 39.00 %
        //got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.03 C Press 959.00 mBar
        var state2add = false;
        for (var _i = 0; _i < datapoints; _i++) {
            var _idx = 0;
            if (adapter.config.device == "CUL") {
                _idx = 11 + (_i * 5);
            }
            else if (adapter.config.device == "HomeControl") {
                _idx = 10 + (_i * 3);
            }
            //adapter.log.info("index " + _idx);
            var _state = res[_idx];

            var _value;
            var found = false;
            var k = 1;
            while (!found) {
                _value = parseFloat(res[_idx + k].substr(0));

                k++;
                if (!isNaN(_value)) //check NaN
                {
                    found = true;
                }

                else if (k > 5) {
                    adapter.log.warn("value not found")
                    found = true;
                }
            }
            adapter.log.info("on index " + _idx + " : " + _state + " = " + _value);



            if (!objects[id + '.' + _state]) {
                //add new states if not exists
                state2add = true;
                adapter.log.info(id + '.' + _state + " not found; try to add");
            }

            //just update value for all states
            adapter.setState(id + '.' + _state, { val: _value, ack: true });
        }

        //add new states
        if (!objects[id] || state2add) {
            adapter.log.info("add new device " + id);
            var newObjects = [];
            var newDevice = {
                _id: id,
                type: 'device',
                common: {
                    name: type
                },
                native: ""
            };

            for (var i = 0; i < datapoints; i++) {
                var common = {};
                var idx = 0;
                if (adapter.config.device == "CUL") {
                    idx = 11 + (i * 5);
                }
                else if (adapter.config.device == "HomeControl") {
                    idx = 10 + (i * 3);
                }
                var _state = res[idx];
                //var value = parseFloat(res[12+ i*3].substr(0));
                //var unit = res[13+i*3];

                if (metaRoles[id + '_' + _state]) {
                    common = metaRoles[id + '_' + _state];
                } else if (metaRoles[_state]) {
                    common = metaRoles[_state];
                }

                common.name = _state;

                adapter.log.info("add new state " + id + '.' + _state);
                var newState = {
                    _id: id + '.' + _state,
                    type: 'state',
                    common: common,
                    native: {}
                };

                objects[id + '.' + _state] = newState;
                newObjects.push(newState);
            }
            objects[id] = newDevice;
            newObjects.push(newDevice);

            insertObjects(newObjects);
        }
    }

    catch (e) {
        var sText = e.toString();
        if (sText.indexOf("Cannot read property 'substr' of undefined") > 0) {

        }
        else {
            adapter.log.error('exception in  sendSerialData 2 [' + e + ']');
        }
        return;
    }

    receivedData = "";
}

function showPortClose() {
    adapter.log.debug('port closed.');
}

function showError(error) {
    adapter.log.error('Serial port error: ' + error);
}