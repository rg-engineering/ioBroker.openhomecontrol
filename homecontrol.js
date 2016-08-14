/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('homecontrol');

var devices = {};

var myPort = null;

try {
    var SerialPort = require('serialport');
} catch (e) {
    console.warn('Serial port is not installed');
}


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
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));

    //feuert auch, wenn adapter im admin anghalten oder gestartet wird...

    if (obj == null && myPort != null) {
        myPort.close();
    }

});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    try {
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready ');
    }
});

function main() {
    var options = {
        // serialport: adapter.config.serialport || '/dev/ttyACM0',
        serialport: adapter.config.serialport || 'COM7',
        baudrate: adapter.config.baudrate || 115200
    };

    try {
        myPort = new SerialPort(options.serialport, {
            baudRate: 115200
        });

    } catch (e) {
        console.warn('Serial port is not created');
    }

    myPort.on('open', showPortOpen);
    myPort.on('data', sendSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);

    adapter.log.info('port created; portname: ' + options.serialport);
    adapter.log.info('Data rate: ' + myPort.options.baudRate + ' ' + options.baudrate);


    

}


function showPortOpen() {
    if (myPort != null) {
        adapter.log.info('port open. ');
        myPort.write("V\n\r");
        myPort.write("hr\n\r");
    }
}

/*
function insertObjects(objs) {
    if (objs.length < 1) {
        return;
    } else {
        var newObject = objs.pop();
        adapter.setObject(newObject._id, newObject, function (err, res) {
            adapter.log.info('object ' + adapter.namespace + '.' + newObject._id + ' created');
            setTimeout(insertObjects, 0, objs);
        });
    }
}
*/


function findDevice(sourceId) {

    return -1;
}

function addDevice(sourceId) {

    var obj;


    adapter.setObject(obj._id, obj, function (err) {
        if (err) adapter.log.error(err);
    })

}

function sendSerialData(data) {
    data = data.toString();

    if (data.length < 2) {
        return;
    }
    adapter.log.info(data);

    if (data.includes("receive off")) {
        adapter.log.info('port reopen. ');
        myPort.write("V\n\r");
        myPort.write("hr\n\r");
        return;
    }
    if (data.includes("receive on")) {

        return;
    }

    //got data from Sensor :3FAF82180000 with 2 DP as broadcast Temp 30.64 C Press 958.32 mBar
    try {

        var res = data.split(" ");
        var source = res[4].substr(1); //remove first character
        var datapoints = parseInt(res[7].substr(0));
        adapter.log.info("from " + source + " with " + datapoints);

        //for (i = 0; i < datapoints; i++) {
        //}



        if (findDevice(source) == -1) {
            addDevice(source);
        }



    }

    catch (e) {
        adapter.log.error('exception in  sendSerialData [' + e + ']');
    }
}

function showPortClose() {
    adapter.log.info('port closed.');
}

function showError(error) {
    adapter.log.error('Serial port error: ' + error);
}