/*
 * myhomecontrol adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene

*/


/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
//var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const utils = require('@iobroker/adapter-core');


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
//this is the old version without compact
//var adapter = utils.adapter('myhomecontrol');




var myPort = null;
var SerialPort = null;
var receivedData = "";
var SentData2Compare = "";
var CompareErrCnt = 0;

var SendTimerBroadcast = null;
//var Watchdog = null;
//var Waitung4Watchdog = false;


var DataToSend = {};
var DataToSendLength = 0;
var IDX_DATENPUNKTE = 14;
var IDX_TYPE = 13;
var IDX_TARGET = 7;
var IDX_SOURCE = 1;
var IDX_START = 0;

var AlreadySending = false;

const newDevices = [];

let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'myhomecontrol',
        ready: function () {
            try {
                //adapter.log.debug('start');
                main();
            }
            catch (e) {
                adapter.log.error('exception catch after ready [' + e + ']');
            }
        },
        //Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
        message: function (obj) {
            if (obj) {
                switch (obj.command) {
                    case 'send':
                        // e.g. send email or pushover or whatever
                        adapter.log.debug('send command');

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
                                adapter.sendTo(obj.from, obj.command, [{ comName: 'Not available' }], obj.callback);
                            }
                        }
                        break;
                    case 'listDevices':
                        ListDevices(obj);
                        break;
                    default:
                        adapter.log.error('unknown message ' + obj.command);
                        break;
                }
            }
        }
    });
    adapter = new utils.Adapter(options);

    return adapter;
};
        

//Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
/*adapter.on('message', function (obj) {
	if (obj) {
        switch (obj.command) {
        	case 'send':
        		// e.g. send email or pushover or whatever
                adapter.log.debug('send command');

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
            case 'listDevices':
                ListDevices(obj);
                break;
            default:
                break;
    	}
    }
});
*/

// is called when adapter shuts down - callback has to be called under any circumstances!
/*adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    }
    catch (e) {
        callback();
    }
});
*/



// is called when databases are connected and adapter received configuration.
// start here!
/*adapter.on('ready', function () {
    try {
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready [' + e + ']');
    }
});
*/

function main() {

    var options = {
        //serialport: adapter.config.serialport || '/dev/ttyACM0',
        serialport: adapter.config.serialport || 'COM13',
        baudrate: parseInt(adapter.config.baudrate) || 57600,
        //device: adapter.config.device || "HomeControl",
        sendInterval2Display: parseInt(adapter.config.sendInterval2Display) || 180,
        sendIntervalBroadcast: parseInt(adapter.config.sendIntervalBroadcast) || 30
    };

    try {
        SerialPort = require('serialport');

        adapter.log.info('Serial port is installed successfully');
    } catch (e) {
        adapter.log.error('Serial port is not installed [' + e + ']');
    }


    try {

        SerialPort.list(function (err, ports) {
            ports.forEach(function (port) {
                adapter.log.info(port.comName + ' ' + port.pnpId + ' ' + port.manufacturer);
            });
        });
    } catch (e) {
        adapter.log.error('Serial port does not exist [' + e + ']');
    }

    //Rechte im Linux gesetzt??? 
    try {
        myPort = new SerialPort(options.serialport, {
            baudRate: options.baudrate
        });

    } catch (e) {
        adapter.log.error('Serial port is not created [' + e + ']');
    }

    adapter.log.info('port created; portname: ' + options.serialport + ' Data rate: ' + myPort.baudRate);


    myPort.on('open', showPortOpen);
    myPort.on('data', receiveSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);


    adapter.log.info("HomeControl used in raw mode");


    try {
        if (!SendTimerBroadcast && options.sendIntervalBroadcast > 0) {
            adapter.log.debug("init timer broadcast with " + options.sendIntervalBroadcast + "s");
            var _SendTimerBroadcast = setInterval(function () {
                SendDataBroadcast();
            }, options.sendIntervalBroadcast * 1000);
            SendTimerBroadcast = _SendTimerBroadcast;
        }
        /*
        var _Watchdog = setInterval(function () {
            WatchDog();
        }, 60000);
        Watchdog = _Watchdog;
        */
    }
    catch (e) {
        adapter.log.error('exception in  init timer [' + e + ']');
    }

}




function showPortOpen() {

    try {
        if (myPort != null) {
            //adapter.log.debug('port open: ' + myPort.options.baudRate + ' ' + myPort.comName);
            //with serialport 5.0.0:
            adapter.log.debug('port open: ' + myPort.baudRate);

        }
    }

    catch (e) {
        adapter.log.error('exception in  showPortOpen [' + e + ']');
    }
}

function SetMode() {
    try {
        if (myPort != null) {
            adapter.log.debug('raw data mode set on ' + myPort.path);
            myPort.write("mr");
            myPort.write("\n\r");
        }
    }

    catch (e) {
        adapter.log.error('exception in  SetMode [' + e + ']');
    }
}

function receiveSerialData(data) {


    data = data.toString();

    receivedData = receivedData + data;

    //adapter.log.debug('--' + data);

    // filter out everyting not needed...
    // if got data not in then drop message
    /*
    if (receivedData.indexOf("for Nano") >= 0) {

        adapter.log.warn('watchdog ' + receivedData );
        Waitung4Watchdog = false;
        receivedData = "";
    }
*/
    if (receivedData.indexOf("too many data") >= 0) {
        receivedData = "";
        adapter.log.error('message to sender too long');
        
    }

    /*
    //only once after boot of Nano
    if (receivedData.indexOf("RAM") >= 0) {
        receivedData = "";
        setTimeout(function () {
            SetMode();
        }, 2000);
    }
    */

    //telegram starts with I and ends with J
    if (receivedData.indexOf("I") >= 0 && receivedData.indexOf("J") > 0) {
        //adapter.log.debug('now going to interprete ' + receivedData);
        receiveSerialDataRaw(receivedData);
    }
    /*
    else if (receivedData.indexOf("X") >= 0 && receivedData.indexOf("Y") > 0) {
        adapter.log.debug('now going to interprete ' + receivedData);
        receiveSerialDataRaw(receivedData);
    }
    else if (receivedData.indexOf("I") < 0 && receivedData.indexOf("X") < 0) {
        //ignore the rest...
        receivedData = "";
    }
    */
    else if (receivedData.indexOf("I") < 0 ) {
        //ignore the rest...
        receivedData = "";
    }


}

function AddDatapoints4Display(id) {
    //adapter.log.debug("found a display; add datapoints");
    adapter.setObjectNotExists(id + "." + "Temp2Display", {
        type: "state",
        common: {
            name: "Temperature",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "°C"
        }
    });

    adapter.setObjectNotExists(id + "." + "TempForecast2Display", {
        type: "state",
        common: {
            name: "Temperature Forecast",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "°C"
        }
    });


    adapter.setObjectNotExists(id + "." + "Humidity2Display", {
        type: "state",
        common: {
            name: "Humidity",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "%"
        }
    });

    adapter.setObjectNotExists(id + "." + "Pressure2Display", {
        type: "state",
        common: {
            name: "Pressure",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "kPa"
        }
    });

    adapter.setObjectNotExists(id + "." + "WeatherIconString2Display", {
        type: "state",
        common: {
            name: "WeatherIcon String Forecast",
            type: "string",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });

    adapter.setObjectNotExists(id + "." + "WeatherIconID2Display", {
        type: "state",
        common: {
            name: "WeatherIcon ID Forecast",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });

    adapter.setObjectNotExists(id + "." + "PoP2Display", {
        type: "state",
        common: {
            name: "Percentage of precipitation Forecast",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "%"
        }
    });

    adapter.setObjectNotExists(id + "." + "Rain2Display", {
        type: "state",
        common: {
            name: "Rain Forecast",
            type: "number",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true,
            unit: "mm"
        }
    });
}


function findObjectByKey(array, key, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i][key] === value) {
            return array[i];
        }
    }
    return null;
}

//this will be the new function to interprete raw data sent by nano
/*
 Protokollbeschreibung:
 0.-5. Byte Quelle-ID (6Byte)
 6.-11. Byte Ziel-ID (0xFE Broadcast, 0x10 Zentrale) (6Byte)
 12. Byte ModulType (0x01 Sensor, 0x02 Aktor, 0x03 Display 0x10 Zentrale)
 13. Byte Anzahl Datenpunkt (nicht Länge!)

 CRC über gesamtes Telegram vom chip selbst

*/
function receiveSerialDataRaw(dataorg) {



    /*
    myhomecontrol.0	2017- 03 - 13 19:56:54.041	debug	s
    myhomecontrol.0	2017- 03 - 13 19:56:54.031	debug	0 16 16 16 16 16 16 152 14 15 130 1 8 16 0
    myhomecontrol.0	2017- 03 - 13 19:56:53.863	debug	add header: 98 ef 82 18 = 152 14 15 130 1 8
    myhomecontrol.0	2017- 03 - 13 19:56:53.861	debug	Send data to Display 98 ef 82 18
    myhomecontrol.0	2017- 03 - 13 19:56:53.853	debug	(2) from 98 ef 82 18 (Display) with 0
    myhomecontrol.0	2017- 03 - 13 19:56:53.847	debug	found a display; add datapoints
    now going to interprete I 00 98 ef 82 18 00 00 fe fe fe fe fe fe 03 00 J
    */

    var data = dataorg.substr(5, dataorg.length - 6);
    var dataArray = data.split(" ");

    try {
        //interprete header
        var bytenumber = 0;
        var source = data.substr(bytenumber, 17);
        source = source.replace(/ /g, ''); //alle Leerzeichen entfernen
        source = source.toUpperCase(); //und alles in Großbuchstaben
        bytenumber += 6;
        var target = data.substr(bytenumber * 2, 17);
        target = target.replace(/ /g, ''); //alle Leerzeichen entfernen
        target = target.toUpperCase(); //und alles in Großbuchstaben
        bytenumber += 6;
        var type = parseInt(dataArray[bytenumber], 16);
        bytenumber += 1;
        var datapoints = parseInt(dataArray[bytenumber], 16);
        bytenumber += 1;

        var stype = "unknown";
        switch (type) {
            case 0x01:
                stype = "Sensor";
                break;
            case 0x02:
                stype = "Actor";
                break;
            case 0x03:
                stype = "Display";
                break;
            case 0x10:
                stype = "Zentrale";
                break;
        }
        adapter.log.debug("(2) from " + source + " (" + stype + ") with " + datapoints + " DPs");


        //check wether device is already accepted; if not then just add it into newDevices - list

        var obj = findObjectByKey(adapter.config.devices, 'name', source);

        if (obj != null && obj.isUsed) {

            adapter.setObjectNotExists(source, {
                type: "device",
                common: {
                    name: stype,
                }
            });


            if (type == 0x03) {
                AddDatapoints4Display(source);
            }

            if (datapoints > 100) // shouldnt be... 
            {
                //too many! 87,fb,30,03,08,00,fe,fe,fe,fe,fe,fe,03,80,J
                adapter.log.warn("too many! " + dataArray);
            }
            else {
                // than all datapoints
                for (var i = 0; i < datapoints; i++) {
                    bytenumber = InterpreteDatapoint(dataArray, bytenumber, source);
                }
            }
            adapter.setObjectNotExists(source + ".LastUpdate", {
                type: "state",
                common: {
                    name: "Last update",
                    type: "datetime",
                    role: "indicator.date",
                    read: true,
                    write: false
                }
            });
            var theDate = new Date();
            adapter.setState(source + ".LastUpdate", { val: theDate.toString(), ack: true });

            if (type == 0x03) {
                
                SendData2Display(source);
            }
        }
        else {

            var obj1 = findObjectByKey(newDevices, 'name', source);

            if (obj1==null) {
                //adapter.log.debug(source + " is new");
                newDevices.push({
                    name: source,
                    type: stype,
                    isUsed: false
                });
            }
            else {
                //adapter.log.debug(source + " already in list");
            }
        }
    }
    catch (e) {
        adapter.log.error('exception in receiveSerialDataRaw [' + e + ']');
    }
    receivedData = "";
}

/*
pro Datenpunkt:
0. Byte Type (0x01 Temp, 0x02 Feuchte, 0x03 Luftqualität, 0x04 Datum, 0x05 Uhrzeit, 0x06 Helligkeit, 0x07 Batteriezustand, 0x08 Sabotage, 0x09 AirPressur. 0x0A error message, 0x0B WeatherIcon)
1. Byte Type / Länge der Daten (0x01 Byte 0x02 int 0x03 float 0x04 string 0x05 date 0x06 time)
2. Byte Daten
3. Byte Einheit (0x00 ohne, 0x01 °C, 0x02 %, 0x03 mBar, 0x04 lux)
*/
/*
updateCE1283180000.unknown with undefined unknown bytenumber: 26
ce, 12, 83, 18, 00, 00, fe, fe, fe, fe, fe, fe, 01, 04, 01, 03, e8, 2b, b1, 41, 01, 09, 03, 48, 83, 73, 44, 03, 02, 03, 00, 00, 2a, 42, 02, 06, 02, 00, 01, 04, J
updateCE1283180000.unknown with undefined unknown bytenumber: 23
ce, 12, 83, 18, 00, 00, fe, fe, fe, fe, fe, fe, 01, 04, 01, 03, e8, 2b, b1, 41, 01, 09, 03, 48, 83, 73, 44, 03, 02, 03, 00, 00, 2a, 42, 02, 06, 02, 00, 01, 04, J
updateCE1283180000.unknown with undefined unknown bytenumber: 20
ce, 12, 83, 18, 00, 00, fe, fe, fe, fe, fe, fe, 01, 04, 01, 03, e8, 2b, b1, 41, 01, 09, 03, 48, 83, 73, 44, 03, 02, 03, 00, 00, 2a, 42, 02, 06, 02, 00, 01, 04, J
updateCE1283180000.unknown with undefined unknown bytenumber: 17
ce, 12, 83, 18, 00, 00, fe, fe, fe, fe, fe, fe, 01, 04, 01, 03, e8, 2b, b1, 41, 01, 09, 03, 48, 83, 73, 44, 03, 02, 03, 00, 00, 2a, 42, 02, 06, 02, 00, 01, 04, J
(2) from CE1283180000 (Sensor) with 4 DPs
*/

function InterpreteDatapoint(dataArray, bytenumber, source) {




    //adapter.log.debug(dataArray);
    var stype = "unknown";
    var type = parseInt( dataArray[bytenumber],16);
    bytenumber++;

    //adapter.log.debug("type " + type);
    switch (type) {
        case 0x01:
            stype = "Temperature";
            break;
        case 0x02:
            stype = "Humidity";
            break;
        case 0x03:
            stype = "AirQuality";
            break;
        case 0x04:
            stype = "Date";
            break;
        case 0x05:
            stype = "Time";
            break;
        case 0x06:
            stype = "Brightness";
            break;
        case 0x07:
            stype = "Battery";
            break;
        case 0x08:
            stype = "Sabotage";
            break;
        case 0x09:
            stype = "AirPressur";
            break;
        case 0x0A:
            stype = "Error";
            break;
        case 0x0B:
            stype = "WeatherIcon"
            break;
        case 0x0C:
            stype = "PoP"
            break;
        case 0x0D:
            stype = "AvgWindSpeed"
            break;
        case 0x0E:
            stype = "WindGust"
            break;
        case 0x0F:
            stype = "WindDir"
            break;
        case 0x10:
            stype = "Rain_forecast"
            break;
        case 0x11:
            stype = "Temperature_forecast"
            break;
    }

    var datatype = parseInt( dataArray[bytenumber],16);
    bytenumber++;
    var value;
    //adapter.log.debug("datatype " + datatype);
    var sDataType = "unknown";
    switch (datatype) {
        case 0x01: // Byte 
            value = parseInt(dataArray[bytenumber], 16);
            bytenumber++;
            sDataType = "byte";
            break;
        case 0x02: // int 
            value = parseInt(dataArray[bytenumber], 16) << 8;
            bytenumber++;
            value = value + parseInt(dataArray[bytenumber], 16);
            bytenumber++;
            sDataType = "int";
            break;
        case 0x03: // float

            var farr = new Float32Array(1);

            var barr = new Int8Array(farr.buffer);

            barr[0] = parseInt(dataArray[bytenumber], 16);
            barr[1] = parseInt(dataArray[bytenumber + 1], 16);
            barr[2] = parseInt(dataArray[bytenumber + 2], 16);
            barr[3] = parseInt(dataArray[bytenumber + 3], 16);

            value = (farr[0]).toFixed(2);
            bytenumber = bytenumber + 4;
            sDataType = "float";
            break;
        case 0x04: // string
            sDataType = "string";
            break;
        /*
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.512	debug	update101010101010.Time with 0: 0: 0 bytenumber: 32
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.512	debug	type 5 datatype 6 dataunit 0
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.511	warn--- 00 d 00 2d 00 1c
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.510	debug	update101010101010.Date with 0.0.7168 bytenumber: 23
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.510	debug	type 4 datatype 5 dataunit 0
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.509	warn+++ 00 17 00 09 07 e2
            myhomecontrol.0	2018 - 09 - 23 13: 45: 28.507	debug(2) from 101010101010(Zentrale) with 2 DPs
            */
        case 0x05: // date

            //adapter.log.warn("+++ " + dataArray[bytenumber] + " " + dataArray[bytenumber + 1] + " " + dataArray[bytenumber +2 ] + " " + dataArray[bytenumber + 3] + " " + dataArray[bytenumber +4] + " " + dataArray[bytenumber + 5]  );

            var a = parseInt(dataArray[bytenumber], 16) << 8;
            var b = parseInt(dataArray[bytenumber + 1], 16);
            var day = a + b;

            a = parseInt(dataArray[bytenumber + 2], 16) << 8;
            b = parseInt(dataArray[bytenumber + 3], 16);
            var month = a + b;

            a = parseInt(dataArray[bytenumber + 4], 16) << 8;
            b = parseInt(dataArray[bytenumber + 5], 16);
            var year = a + b;
            bytenumber = bytenumber + (3 * 2);
            value = day + "." + month + "." + year;
            sDataType = "date";
            break;
        case 0x06: // time

            //adapter.log.warn("--- " + dataArray[bytenumber] + " " + dataArray[bytenumber + 1] + " " + dataArray[bytenumber + 2] + " " + dataArray[bytenumber + 3] + " " + dataArray[bytenumber + 4] + " " + dataArray[bytenumber + 5]);

            var a = parseInt(dataArray[bytenumber], 16) << 8;
            var b = parseInt(dataArray[bytenumber + 1], 16);
            var hour = a + b;

            a = parseInt(dataArray[bytenumber + 2], 16) << 8;
            b = parseInt(dataArray[bytenumber + 3], 16);
            var minute = a + b;

            a = parseInt(dataArray[bytenumber + 4], 16) << 8;
            b = parseInt(dataArray[bytenumber + 5], 16);
            var second = a + b;
            bytenumber = bytenumber + (3 * 2);
            value = hour + ":" + minute + ":" + second;
            sDataType = "time";
            break;
    }

    var sdataunit = "unknown";
    var dataunit = parseInt( dataArray[bytenumber],16);
    bytenumber++;
    //adapter.log.debug("dataunit " + dataunit);
    switch (dataunit) {
        case 0x00:
            sdataunit = ""; //ohne
            break;
        case 0x01:
            sdataunit = "°C";
            break;
        case 0x02:
            sdataunit = "%";
            break;
        case 0x03:
            sdataunit = "mBar";
            break;
        case 0x04:
            sdataunit = "lux";
            break;
        case 0x05:
            sdataunit = "m/s";
            break;
        case 0x06:
            sdataunit = "deg";
            break;
        case 0x07:
            sdataunit = "mm";
            break;
    }
    adapter.log.debug(stype + " (" + sDataType + ") " + value + " " + sdataunit  );
    

    adapter.setObjectNotExists(source + "." + stype, {
        type: "state",
        common: {
            name: stype,
            type: "state",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: false
        }
    });

    //adapter.log.debug("update " + source + "." + stype + " with " + value + " " + sdataunit + " bytenumber: " + bytenumber);

    adapter.setState(source + '.' + stype, { val: value, ack: true });

    return bytenumber;
}



function showPortClose() {
    adapter.log.debug('port closed.');
}

function showError(error) {
    adapter.log.error('Serial port error: ' + error);
}


//=================================== send functions =========================================

function lowByte(w) {
    return ((w) & 0xff);
}
function highByte(w) {
    return(((w) >> 8) & 0xff);
}

function AddHeader(target, DisplayID) {
    DataToSend[IDX_START] = 0x00;
    DataToSend[IDX_SOURCE] = 0x10;  //source: meine ID 6Byte; zentrale
    DataToSend[IDX_SOURCE + 1] = 0x10;  //
    DataToSend[IDX_SOURCE + 2] = 0x10;  //
    DataToSend[IDX_SOURCE + 3] = 0x10;  //
    DataToSend[IDX_SOURCE + 4] = 0x10;  //
    DataToSend[IDX_SOURCE + 5] = 0x10;  //

    if (target == 0xFE) {
        DataToSend[IDX_TARGET] = 0xFE;  //Target: Broadcast 6Byte
        DataToSend[IDX_TARGET + 1] = 0xFE;
        DataToSend[IDX_TARGET + 2] = 0xFE;
        DataToSend[IDX_TARGET + 3] = 0xFE;
        DataToSend[IDX_TARGET + 4] = 0xFE;
        DataToSend[IDX_TARGET + 5] = 0xFE;
    }
    else {
        //to do: über alle displays
        //98EF82180000

        //DisplayId ist string
        //wir brauchen die Werte
        /*
        adapter.log.debug('add header: ' + DisplayID + ' = ' +
            parseInt(DisplayID.substr(0, 2),16) + ' ' +
            parseInt(DisplayID.substr(2, 2),16) + ' ' +
            parseInt(DisplayID.substr(4, 2),16) + ' ' +
            parseInt(DisplayID.substr(6, 2),16) + ' ' +
            parseInt(DisplayID.substr(8, 2),16) + ' ' +
            parseInt(DisplayID.substr(10, 2),16)
        );
        */
        DataToSend[IDX_TARGET] = parseInt(DisplayID.substr(0, 2),16);
        DataToSend[IDX_TARGET + 1] = parseInt(DisplayID.substr(2, 2),16);
        DataToSend[IDX_TARGET + 2] = parseInt(DisplayID.substr(4, 2),16);
        DataToSend[IDX_TARGET + 3] = parseInt(DisplayID.substr(6, 2),16);
        DataToSend[IDX_TARGET + 4] = parseInt(DisplayID.substr(8, 2),16);
        DataToSend[IDX_TARGET + 5] = parseInt(DisplayID.substr(10, 2),16);
    }

    DataToSend[IDX_TYPE] = 0x10;  //Type: Zentrale
    DataToSend[IDX_DATENPUNKTE] = 0x00;  //Datenpunkte
    DataToSendLength = IDX_DATENPUNKTE + 1;
}

function AddTime(){
    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
    DataToSend[DataToSendLength] = 0x05;  //Time
    DataToSend[DataToSendLength + 1] = 0x06; //time: 3*int hh::mm::ss

    var theDate = new Date();

    var hour = theDate.getHours();
    var minute = theDate.getMinutes();
    var second = theDate.getSeconds();

    DataToSend[DataToSendLength + 2] = highByte(hour);
    DataToSend[DataToSendLength + 3] = lowByte(hour);

    DataToSend[DataToSendLength + 4] = highByte(minute);
    DataToSend[DataToSendLength + 5] = lowByte(minute);

    DataToSend[DataToSendLength + 6] = highByte(second);
    DataToSend[DataToSendLength + 7] = lowByte(second);


    DataToSend[DataToSendLength + 8] = 0x00; //ohne einheit

    DataToSendLength += 9;

    //adapter.log.debug('Time ' + hour + ':' + minute + ':' + second);

    CheckDataLength();
}

function AddDate(){
    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
    DataToSend[DataToSendLength] = 0x04;  //Date
    DataToSend[DataToSendLength + 1] = 0x05; //date: 3*int dd.mm.yyyy

    var theDate = new Date();

    var day = theDate.getDate();
    var month = theDate.getMonth()+1;
    var year = theDate.getFullYear();

    DataToSend[DataToSendLength + 2] = highByte(day);
    DataToSend[DataToSendLength + 3] = lowByte(day);

    DataToSend[DataToSendLength + 4] = highByte(month);
    DataToSend[DataToSendLength + 5] = lowByte(month);

    DataToSend[DataToSendLength + 6] = highByte(year);
    DataToSend[DataToSendLength + 7] = lowByte(year);

    DataToSend[DataToSendLength + 8] = 0x00; //ohne einheit

    DataToSendLength += 9;

    //adapter.log.debug('Date ' + day + '.' + month + '.' + year);

    CheckDataLength();
}

function AddTemperature(DisplayID) {
    try {
        //adapter.log.debug("add temperatur");

        adapter.getState(DisplayID + '.Temp2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
                
                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.Temp2Display', { ack: true });
                    var temperature = obj.val;
                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x01;  //Temperature
                    DataToSend[DataToSendLength + 1] = 0x03; //float


                    var farr = new Float32Array(1);
                    farr[0] = temperature;
                    var barr = new Int8Array(farr.buffer);


                    DataToSend[DataToSendLength + 2] = barr[0];
                    DataToSend[DataToSendLength + 3] = barr[1];
                    DataToSend[DataToSendLength + 4] = barr[2];
                    DataToSend[DataToSendLength + 5] = barr[3];


                    DataToSend[DataToSendLength + 6] = 0x01; //°C

                    DataToSendLength += 7;

                    //adapter.log.debug('Temperature ' + temperature);

                    CheckDataLength();
                }
                AddHumidity(DisplayID);

            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddTemperature [' + e + ']');
    }
}

function AddHumidity(DisplayID) {
    try {
        //adapter.log.debug("add humidity");

        adapter.getState(DisplayID + '.Humidity2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {

                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.Humidity2Display', { ack: true });
                    var humidity = obj.val;

                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x02;  //Humidity
                    DataToSend[DataToSendLength + 1] = 0x03; //float


                    var farr = new Float32Array(1);
                    farr[0] = humidity;
                    var barr = new Int8Array(farr.buffer);


                    DataToSend[DataToSendLength + 2] = barr[0];
                    DataToSend[DataToSendLength + 3] = barr[1];
                    DataToSend[DataToSendLength + 4] = barr[2];
                    DataToSend[DataToSendLength + 5] = barr[3];


                    DataToSend[DataToSendLength + 6] = 0x02; //%

                    DataToSendLength += 7;

                    //adapter.log.debug('Humidity ' + humidity);

                    CheckDataLength();
                }
                AddPoP(DisplayID);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddHumidity [' + e + ']');
    }
}

function AddPoP(DisplayID) {
    try {

        //adapter.log.debug("add pop");

        adapter.getState(DisplayID + '.PoP2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {

                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.PoP2Display', { ack: true });
                    var pop = obj.val;

                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x0C;  //pop
                    DataToSend[DataToSendLength + 1] = 0x02; //int

                    DataToSend[DataToSendLength + 2] = highByte(pop);
                    DataToSend[DataToSendLength + 3] = lowByte(pop);

                    DataToSend[DataToSendLength + 4] = 0x02; //%

                    DataToSendLength += 5;

                    //adapter.log.debug('PoP ' + pop);

                    CheckDataLength();
                }
                AddAirPressure(DisplayID);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddPoP [' + e + ']');
    }
}

function AddAirPressure(DisplayID) {
    try {
        //adapter.log.debug("add pressure");

        adapter.getState(DisplayID + '.Pressure2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.Pressure2Display', { ack: true });
                    var pressure = obj.val;

                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x09;  //Pressure
                    DataToSend[DataToSendLength + 1] = 0x03; //float

                    var farr = new Float32Array(1);
                    farr[0] = pressure;
                    var barr = new Int8Array(farr.buffer);

                    DataToSend[DataToSendLength + 2] = barr[0];
                    DataToSend[DataToSendLength + 3] = barr[1];
                    DataToSend[DataToSendLength + 4] = barr[2];
                    DataToSend[DataToSendLength + 5] = barr[3];


                    DataToSend[DataToSendLength + 6] = 0x03; //mBar

                    DataToSendLength += 7;

                    //adapter.log.debug('Pressure ' + pressure);

                    CheckDataLength();
                }
                AddWeatherIconIdFromString(DisplayID);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddAirPressure [' + e + ']');
    }
}

function AddWeatherIconIdFromString(DisplayID) {
    try {

        //adapter.log.debug("add icon");

        adapter.getState(DisplayID + '.WeatherIconString2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
                if (obj != null) {

                    //set ack-flag
                    adapter.setState(DisplayID + '.WeatherIconString2Display', { ack: true });

                    var icon = obj.val;

                    var icon_id = -1;

                    // das ist WU
                    switch (icon) {
                        case "clear":
                        case "nt_clear":
                            icon_id = 1;
                            break;
                        case "partlycloudy":
                        case "nt_partlycloudy":
                            icon_id = 2;
                            break;
                        case "mostlycloudy":
                        case "nt_mostlycloudy":
                            icon_id = 3;
                            break;
                        case "cloudy":
                        case "nt_cloudy":
                            icon_id = 4;
                            break;
                        case "hazy":
                        case "nt_hazy":
                            icon_id = 5;
                            break;
                        case "foggy":
                        case "nt_foggy":
                            icon_id = 6;
                            break;
                        case "veryhot":
                        case "nt_veryhot":
                            icon_id = 7;
                            break;
                        case "verycold":
                        case "nt_verycold":
                            icon_id = 8;
                            break;
                        case "blowingsnow":
                        case "nt_blowingsnow":
                            icon_id = 9;
                            break;
                        case "chanceshowers":
                        case "nt_chanceshowers":
                            icon_id = 10;
                            break;
                        case "showers":
                        case "nt_showers":
                            icon_id = 11;
                            break;
                        case "chancerain":
                        case "nt_chancerain":
                            icon_id = 12;
                            break;
                        case "rain":
                        case "nt_rain":
                            icon_id = 13;
                            break;
                        case "chancetstorms":
                        case "nt_chancetstorms":
                        case "chancethunderstorm":
                        case "nt_chancethunderstorm":
                            icon_id = 14;
                            break;

                        case "tstorms":
                        case "nt_tstorms":
                        case "thunderstorm":
                        case "nt_thunderstorm":
                            icon_id = 15;
                            break;
                        case "flurries":
                        case "nt_flurries":
                            icon_id = 16;
                            break;
                        case "chancesnowshowers":
                        case "nt_chancesnowshowers":
                            icon_id = 18;
                            break;
                        case "snowshowers":
                        case "nt_snowshowers":
                            icon_id = 19;
                            break;
                        case "chancesnow":
                        case "nt_chancesnow":
                            icon_id = 20;
                            break;
                        case "snow":
                        case "nt_snow":
                            icon_id = 21;
                            break;
                        case "chanceicepellets":
                        case "nt_chanceicepellets":
                            icon_id = 22;
                            break;
                        case "icepellets":
                        case "nt_icepellets":
                            icon_id = 23;
                            break;
                        case "blizzard":
                        case "nt_blizzard":
                            icon_id = 24;
                            break;
                        default:
                            adapter.log.error('unknown WeatherIcon ' + icon);
                            break;
                    }




                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x0B; //WeatherIcon
                    DataToSend[DataToSendLength + 1] = 0x01; //byte

                    DataToSend[DataToSendLength + 2] = icon_id;

                    DataToSend[DataToSendLength + 3] = 0x00; //ohne

                    DataToSendLength += 4;

                    //adapter.log.debug('WeatherIcon ' + icon + " = " + icon_id);

                    CheckDataLength();

                    //do not add another icon...
                    AddTemperatureForecast(DisplayID);
                }
                else {
                    AddWeatherIconIdFromID(DisplayID);
                    //sendSerialDataRaw();
                }
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddWeatherIconIdFromString [' + e + ']');
    }
}

function AddWeatherIconIdFromID(DisplayID) {
    try {

        //adapter.log.debug("add icon");

        adapter.getState(DisplayID + '.WeatherIconID2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
                if (obj != null) {

                    //set ack-flag
                    adapter.setState(DisplayID + '.WeatherIconID2Display', { ack: true });

                    var icon_id = obj.val;

                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x0B; //WeatherIcon
                    DataToSend[DataToSendLength + 1] = 0x01; //byte

                    DataToSend[DataToSendLength + 2] = icon_id;

                    DataToSend[DataToSendLength + 3] = 0x00; //ohne

                    DataToSendLength += 4;

                    //adapter.log.debug('WeatherIcon from id : ' +  icon_id);

                    CheckDataLength();
                }
                AddTemperatureForecast(DisplayID);
                
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddWeatherIconIdFromID [' + e + ']');
    }
}

function AddTemperatureForecast(DisplayID) {
    try {
        //adapter.log.debug("add temperatur");

        adapter.getState(DisplayID + '.TempForecast2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {

                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.TempForecast2Display', { ack: true });
                    var temperature = obj.val;
                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x11;  //Temperature forecast
                    DataToSend[DataToSendLength + 1] = 0x03; //float


                    var farr = new Float32Array(1);
                    farr[0] = temperature;
                    var barr = new Int8Array(farr.buffer);


                    DataToSend[DataToSendLength + 2] = barr[0];
                    DataToSend[DataToSendLength + 3] = barr[1];
                    DataToSend[DataToSendLength + 4] = barr[2];
                    DataToSend[DataToSendLength + 5] = barr[3];


                    DataToSend[DataToSendLength + 6] = 0x01; //°C

                    DataToSendLength += 7;

                    //adapter.log.debug('Temperature ' + temperature);

                    CheckDataLength();
                }
                AddRainForecast(DisplayID);

            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddTemperatureForecast [' + e + ']');
    }


}

function AddRainForecast(DisplayID) {
    try {

        //adapter.log.debug("add pop");

        adapter.getState(DisplayID + '.Rain2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {

                if (obj != null) {
                    //set ack-flag
                    adapter.setState(DisplayID + '.Rain2Display', { ack: true });
                    var rain = obj.val;

                    DataToSend[IDX_DATENPUNKTE] = DataToSend[IDX_DATENPUNKTE] + 1;  //Datenpunkte
                    DataToSend[DataToSendLength] = 0x10;  //rain forecast
                    DataToSend[DataToSendLength + 1] = 0x02; //int

                    DataToSend[DataToSendLength + 2] = highByte(rain);
                    DataToSend[DataToSendLength + 3] = lowByte(rain);

                    DataToSend[DataToSendLength + 4] = 0x07; //mm

                    DataToSendLength += 5;

                    //adapter.log.debug('rain ' + rain);

                    CheckDataLength();
                }

                sendSerialDataRaw();
                
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddRainForecast [' + e + ']');
    }
}


function CheckDataLength() {
}

/*
function WatchDog() {

    if (Waitung4Watchdog) {
        adapter.log.error('##watchdog error');
    }

    try {
        if (myPort != null) {
            adapter.log.debug('##watchdog ' + myPort.path);
            myPort.write("v");
            myPort.write("\n\r");
            Waitung4Watchdog = true;
        }
    }

    catch (e) {
        adapter.log.error('exception in  watchdog [' + e + ']');
    }
}
*/

/*
Zeit/Datum-Telegramm
s 0  0  0  0  0  0  0  fe  fe  fe  fe  fe  fe  1 2 4 5 0 15 0  1 7 e1  0 5 6 0  e 0 37 0 22 0  -> HEX 0 als Absender
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 5 6 0 14 0 55 0 34  0 4 5 0 22 0  1 7 225 0 -> DEC Date/Time vertauscht
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 4 5 0 22 0  1 7 225 0 5 6 0 14 0 55 0 34 0 -> DEC wie oben Zentrale als Absender
*/



function SendDataBroadcast() {
    //adapter.log.debug('Send data');

    if (AlreadySending) {
        adapter.log.warn("broadcast: already sending");
        return;
    }

    AlreadySending = true;
    adapter.log.debug("send broadcast");
    try {
        AddHeader(0xFE,"");
        AddDate();
        AddTime();
    }
    catch (e) {
        adapter.log.error('exception in  SendData [' + e + '] ');
    }
    sendSerialDataRaw(); 
}

function SendData2Display(DisplayID) {

    if (AlreadySending) {
        adapter.log.warn("send to display:  already sending");
        return;
    }

    AlreadySending = true;
    adapter.log.debug("send data to " + DisplayID);
    try {
        AddHeader(0x00, DisplayID);
        AddTemperature(DisplayID); //from there we add humidity and then air pressure; don't do it here because it's a asynchron call
    }
    catch (e) {
        adapter.log.error('exception in  SendData [' + e + '] ' + DisplayID);
    }
    //sendSerialDataRaw(); it's called in AddPressure finally

}

function sendSerialDataRaw() {

    try {

        var length = DataToSendLength + 2;
        //adapter.log.debug('sendSerialDataRaw ' + length);

        var buffer = new Buffer(length);
        //copy into buffer for data conversion...
        buffer[0] = 0x53; //== 'S'
        buffer[1] = DataToSendLength;
        for (var i = 0; i < DataToSendLength; i++) {
            buffer[i + 2] = DataToSend[i];
        }

        myPort.write(buffer);

        var sTemp = "";
        for (var j = 0; j < buffer.length; j++) {
            sTemp += buffer[j].toString(16);
            sTemp += " ";
        }
        adapter.log.debug("sent :" + sTemp);

        SentData2Compare = sTemp;

        buffer = null;

    }
    catch (e) {
        adapter.log.error('exception in  sendSerialDataRaw [' + e + ']');
    }
    AlreadySending = false;
}


function DeleteDevices() {
    adapter.getDevices(function (err, devices) {
        for (var d = 0; d < devices.length; d++) {
            //adapter.deleteDevice(devices[d]._id);
            log(devices[d]._id);
        }
    });
}



function ListDevices(obj) {
    
    const allDevices = [];

    //first known devices
    for (var i = 0; i < adapter.config.devices.length; i++) {
        allDevices.push({
            name: adapter.config.devices[i].name,
            type: adapter.config.devices[i].type,
            isUsed: true
        });
    }
    //then all new devices
    for (var i = 0; i < newDevices.length; i++) {
        allDevices.push({
            name: newDevices[i].name,
            type: newDevices[i].type,
            isUsed: false
        });
    }
    //clear the array
    newDevices.length = 0;

    adapter.sendTo(obj.from, obj.command, allDevices, obj.callback);
}


/*
 
 RSSI 220 dBm got data from Zentrale: 10 10 10 10 10 10 Target=87 FB 30 03 08 00 with 5 DP Temperature 3.20°C Humidity 82.00% WeatherIcon  12 unknown type 15.00°C unknown type   2unknown
 */

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 