/*
 * myhomecontrol adapter für iobroker
 *
 * Created: 15.09.2016 21:31:28
 *  Author: Rene

Copyright(C)[2016, 2017][René Glaß]

Dieses Programm ist freie Software.Sie können es unter den Bedingungen der GNU General Public License, wie von der Free Software 
Foundation veröffentlicht, weitergeben und/ oder modifizieren, entweder gemäß Version 3 der Lizenz oder (nach Ihrer Option) jeder 
späteren Version.

Die Veröffentlichung dieses Programms erfolgt in der Hoffnung, daß es Ihnen von Nutzen sein wird, aber OHNE IRGENDEINE GARANTIE,
    sogar ohne die implizite Garantie der MARKTREIFE oder der VERWENDBARKEIT FÜR EINEN BESTIMMTEN ZWECK.Details finden Sie in der
GNU General Public License.

Sie sollten ein Exemplar der GNU General Public License zusammen mit diesem Programm erhalten haben.Falls nicht,
    siehe < http://www.gnu.org/licenses/>.

*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils




// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('myhomecontrol');




var myPort = null;
var receivedData = "";
var SendTimerBroadcast = null;
//var SendTimer2Display = null;

//var WeatherTimer = null;

var DataToSend = {};
var DataToSendLength = 0;
var IDX_DATENPUNKTE = 14;
var IDX_TYPE = 13;
var IDX_TARGET = 7;
var IDX_SOURCE = 1;
var IDX_START = 0;

var AlreadySending = false;

try {
    var SerialPort = require('serialport');
} catch (e) {
    console.warn('Serial port is not installed [' + e + ']');
}


//used for GetWeatherData
//var request = require('request');
//var xmlparser = require('xml2json');

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
        adapter.log.debug('cleaned everything up...');
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

    /*
    stateChange myhomecontrol.0.98EF82180000.WeatherIcon2Display
    {"val":"partlycloudy","ack":false,"ts":1488721037466,"q":0,"from":"system.adapter.javascript.0","lc":1488719660182}
    */



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
        baudrate: parseInt(adapter.config.baudrate) || 57600,
        device: adapter.config.device || "HomeControl",
        sendInterval2Display: parseInt(adapter.config.sendInterval2Display) || 180,
        sendIntervalBroadcast: parseInt(adapter.config.sendIntervalBroadcast) || 30
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

    adapter.log.info('port created; portname: ' + options.serialport + ' ' + myPort.comName + ' ' + myPort.pnpId + ' ' + myPort.manufacturer + ' Data rate: ' + myPort.options.baudRate + ' ' + options.baudrate);

    myPort.on('open', showPortOpen);
    myPort.on('data', receiveSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);

    if (adapter.config.device == "CUL") {
        adapter.log.info("CUL used");
    }
    else if (adapter.config.device == "HomeControl") {
        if (adapter.config.mode == "telegram") {
            adapter.log.info("HomeControl used in telegram mode");
        }
        else if (adapter.config.mode == "raw data") {
            adapter.log.info("HomeControl used in raw mode");
        }
        else {
            adapter.log.warn("HomeControl used in unknown mode");
        }
    }
    else {
        adapter.log.warn("unknown device");
    }

    try {
        if (!SendTimerBroadcast && options.sendIntervalBroadcast > 0) {
            adapter.log.debug("init timer broadcast with " + options.sendIntervalBroadcast + "s");
            var _SendTimerBroadcast = setInterval(function () {
                SendDataBroadcast();
            }, options.sendIntervalBroadcast * 1000);
            SendTimerBroadcast = _SendTimerBroadcast;
        }

/*
        if (!SendTimer2Display && options.sendInterval2Display > 0) {
            adapter.log.debug("init timer to display with " + options.sendInterval2Display + "s");
            var _SendTimer2Display = setInterval(function () {
                SendData2Display();
            }, options.sendInterval2Display * 1000);
            SendTimer2Display = _SendTimer2Display;
        }
   */
    }
    catch (e) {
        adapter.log.error('exception in  init timer [' + e + ']');
    }
/*
    if (!WeatherTimer) {
        var _WeatherTimer = setInterval(function () {
            GetWeatherData();
        }, 33 * 1000);  //intervall evtl. einstellbar??
        WeatherTimer = _WeatherTimer;
    }
    */
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

    //adapter.subscribeStates('*'); //nicht notwendig; wir lesen einfach zeitgesteuert...
}


function showPortOpen() {
	
	try{
		if (myPort != null) {
			adapter.log.debug('port open: ' + myPort.options.baudRate + ' ' + myPort.comName);
            if (adapter.config.device == "CUL") {
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

function SetMode() {
    if (myPort != null) {
        if (adapter.config.device == "HomeControl") {
            //send configuration to nano
            if (adapter.config.mode == "telegram") {
                adapter.log.debug('telegram mode set on ' + myPort.comName);
                myPort.write("mi\n\r");
                //myPort.write(0x0D);
            }
            else
                if (adapter.config.mode == "raw data") {
                    adapter.log.debug('raw data mode set on ' + myPort.comName);
                    myPort.write("mr\n\r");
                    //myPort.write(0x0D);
                }
                else {
                    adapter.log.error('unknown receive mode');
                }
        }
    }
}

function receiveSerialData(data) {
    data = data.toString();

    if (data.length < 2) {
        return;
    }

    receivedData = receivedData + data;

    adapter.log.debug(receivedData);

    if (adapter.config.device == "CUL") {

        try {
            //.contains geht unter linux nicht; unter win schon ???
            if (receivedData.indexOf("receive off") > 0) {
                adapter.log.debug('port reopen. ');

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

        if (receivedData.indexOf("too long") >= 0) {
            receivedData = "";
            adapter.log.error('message to sender too long');
            return;
        }

        //only once after boot of Nano
        if (receivedData.indexOf("RAM") >= 0) {
            setTimeout(function () {
                SetMode();
            }, 2000);
        }

        if (adapter.config.mode == "telegram") {

            if (receivedData.indexOf("data from") <= 0) {

                receivedData = "";
                return;
            }
            else {
                receiveSerialDataTelegram(receivedData);
            }
        }
        else
            if (adapter.config.mode == "raw data") {

                //telegram starts with I and ends with J
                if (receivedData.indexOf("I") >= 0 && receivedData.indexOf("J") > 0) {
                    adapter.log.debug('now going to interprete ' + receivedData);
                    receiveSerialDataRaw(receivedData);
                }
                else if (receivedData.indexOf("I") < 0) {
                    //ignore the rest...
                    receivedData = "";
                    return;
                }
            }
            else {
                adapter.log.error('unknown receive mode');
            }
    }
}

function AddDatapoints4Display(id) {
    adapter.log.debug("found a display; add datapoints");
    adapter.setObjectNotExists(id + "." + "Temp2Display", {
        type: "state",
        common: {
            name: "Temperature",
            type: "state",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });

    adapter.setObjectNotExists(id + "." + "Humidity2Display", {
        type: "state",
        common: {
            name: "Humidity",
            type: "state",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });

    adapter.setObjectNotExists(id + "." + "Pressure2Display", {
        type: "state",
        common: {
            name: "Pressure",
            type: "state",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });

    adapter.setObjectNotExists(id + "." + "WeatherIcon2Display", {
        type: "state",
        common: {
            name: "WeatherIcon",
            type: "state",
            role: "sensor",
            function: "Wetter",
            read: true,
            write: true
        }
    });
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
                stype = "Sensor ";
                break;
            case 0x02:
                stype = "Actor ";
                break;
            case 0x03:
                stype = "Display ";
                AddDatapoints4Display(source);
                break;
            case 0x10:
                stype = "Zentrale ";
                break;
        }
        adapter.log.debug("(2) from " + source + " (" + stype + ") with " + datapoints+ " DPs");
        adapter.setObjectNotExists(source, {
            type: "device",
            common: {
                name: stype,
            }
        });
        // than all datapoints
        for (var i = 0; i < datapoints; i++) {
            bytenumber = InterpreteDatapoint(dataArray,bytenumber,source);
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

    adapter.log.debug(dataArray);
    var stype = "unknown";
    var type = parseInt( dataArray[bytenumber],16);
    bytenumber++;

    adapter.log.debug("type " + type);
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
    }

    var datatype = parseInt( dataArray[bytenumber],16);
    bytenumber++;
    var value;
    adapter.log.debug("datatype " + datatype);
    switch (datatype) {
        case 0x01: // Byte 
            value = parseInt(dataArray[bytenumber], 16);
            bytenumber++;
            break;
        case 0x02: // int 
            value = parseInt(dataArray[bytenumber], 16) << 8;
            bytenumber++;
            value = value + parseInt(dataArray[bytenumber], 16);
            bytenumber++;
            break;
        case 0x03: // float

            var farr = new Float32Array(1);
            
            var barr = new Int8Array(farr.buffer);

            barr[0] = parseInt(dataArray[bytenumber], 16);
            barr[1] = parseInt(dataArray[bytenumber + 1], 16);
            barr[2] = parseInt(dataArray[bytenumber + 2], 16);
            barr[3] = parseInt(dataArray[bytenumber + 3], 16);

            value = farr[0];
            bytenumber = bytenumber + 4;
            break;
        case 0x04: // string 
            //to do..
            break;
        case 0x05: // date
            var day = parseInt(dataArray[bytenumber], 16) << 8 + parseInt(dataArray[bytenumber + 1], 16);
            var month = parseInt(dataArray[bytenumber + 2], 16) << 8 + parseInt(dataArray[bytenumber + 3], 16);
            var year = parseInt(dataArray[bytenumber + 4], 16) << 8 + parseInt(dataArray[bytenumber + 5], 16);
            bytenumber = bytenumber + 3 * 2;
            value = day + "." + month + "." + year;
            break;
        case 0x06: // time
            var hour = parseInt(dataArray[bytenumber], 16) << 8 + parseInt(dataArray[bytenumber + 1], 16);
            var minute = parseInt(dataArray[bytenumber + 2], 16) << 8 + parseInt(dataArray[bytenumber + 3], 16);
            var second = parseInt(dataArray[bytenumber + 4], 16) << 8 + parseInt(dataArray[bytenumber + 5], 16);
            bytenumber = bytenumber + 3 * 2;
            value = hour + ":" + minute + ":" + second;
            break;
    }

    var sdataunit = "unknown";
    var dataunit = parseInt( dataArray[bytenumber],16);
    bytenumber++;
    adapter.log.debug("dataunit " + dataunit);
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
    }

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

    adapter.log.debug("update" + source + "." + stype + " with " + value + " " + sdataunit + " bytenumber: " + bytenumber);

    adapter.setState(source + '.' + stype, { val: value, ack: true });

    return bytenumber;
}


//this is the obsolete old function which will be removed in one of the next releases
//here we need to interprete telegram data on nano. Nano sends then a interpreted telegram like:
//got data from Sensor :3FAF82180000 with 2 DP as broadcast Temp 30.64 C Press 958.32 mBar
function receiveSerialDataTelegram(data) {

    try {
        var res = data.split(" ");
        var id = res[4].substr(0);
        var toSendId = "";

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

        adapter.log.debug("from " + id + " with " + datapoints);

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


        //collect all devices also those without datapoint
        adapter.setObjectNotExists(id, {
            type: "device",
            common: {
                name: type,
            }
        });

        //add writable datapoints for display
        if (type.indexOf("Display") >= 0) {
            AddDatapoints4Display(id);
            

            toSendId = id;
        }


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
            adapter.log.debug("on index " + _idx + " : " + _state + " = " + _value);

            
            //collect datapoints
            //to do: different functions weather, ...
            adapter.setObjectNotExists(id + "." + _state, {
                type: "state",
                common: {
                    name: _state,
                    type: "state",
                    role: "sensor",
                    function: "Wetter",
                    read: true,
                    write: false
                }
            });

            adapter.setState(id + '.' + _state, { val: _value, ack: true });
            
        }


        adapter.setObjectNotExists(id + ".LastUpdate", {
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
        adapter.setState(id + ".LastUpdate", { val: theDate.toString(), ack: true });

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

    //if Display then answer with data
    if (toSendId.length > 0) {
        SendData2Display(toSendId);
    }
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

        adapter.log.debug('add header: ' + DisplayID + ' = ' +
            parseInt(DisplayID.substr(0, 2),16) + ' ' +
            parseInt(DisplayID.substr(2, 2),16) + ' ' +
            parseInt(DisplayID.substr(4, 2),16) + ' ' +
            parseInt(DisplayID.substr(6, 2),16) + ' ' +
            parseInt(DisplayID.substr(8, 2),16) + ' ' +
            parseInt(DisplayID.substr(10, 2),16)
        );

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

    adapter.log.debug('Time ' + hour + ':' + minute + ':' + second);

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

    adapter.log.debug('Date ' + day + '.' + month + '.' + year);

    CheckDataLength();
}

function AddTemperature(DisplayID) {
    try {

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

                    adapter.log.debug('Temperature ' + temperature);

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

                    adapter.log.debug('Humidity ' + humidity);

                    CheckDataLength();
                }
                AddAirPressure(DisplayID);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddHumidity [' + e + ']');
    }
}

function AddAirPressure(DisplayID) {
    try {

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

                    adapter.log.debug('Pressure ' + pressure);

                    CheckDataLength();
                }
                AddWeatherIconId(DisplayID);
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddAirPressure [' + e + ']');
    }
}

function AddWeatherIconId(DisplayID) {
    try {

        adapter.getState(DisplayID + '.WeatherIcon2Display', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
                if (obj != null) {

                    //set ack-flag
                    adapter.setState(DisplayID + '.WeatherIcon2Display', { ack: true });

                    var icon = obj.val;

                    var icon_id = -1;


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
                        case "chancethunderstorm":
                        case "nt_chancethunderstorm":
                            icon_id = 14;
                            break;
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

                    adapter.log.debug('WeatherIcon ' + icon + " = " + icon_id);

                    CheckDataLength();
                }
                sendSerialDataRaw();
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddWeatherIconId [' + e + ']');
    }
}

function CheckDataLength() {
}


/*
Zeit/Datum-Telegramm
s 0  0  0  0  0  0  0  fe  fe  fe  fe  fe  fe  1 2 4 5 0 15 0  1 7 e1  0 5 6 0  e 0 37 0 22 0  -> HEX 0 als Absender
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 5 6 0 14 0 55 0 34  0 4 5 0 22 0  1 7 225 0 -> DEC Date/Time vertauscht
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 4 5 0 22 0  1 7 225 0 5 6 0 14 0 55 0 34 0 -> DEC wie oben Zentrale als Absender
*/

function SendDataBroadcast() {
    //adapter.log.debug('Send data');

    if (AlreadySending)
        return;

    AlreadySending = true;
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

    if (AlreadySending)
        return;

    adapter.log.debug('Send data to Display ' + DisplayID);

    AlreadySending = true;
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
        var sTemp = "";
        myPort.write("s");

        var buffer = new Buffer(DataToSendLength+1);
        //copy into buffer for data conversion...
        for (var i = 0; i < DataToSendLength; i++) {
            buffer[i] = DataToSend[i];
            sTemp += buffer[i];
            sTemp += " ";
        }
        //buffer[DataToSendLength] = 0x0D; //final return
        myPort.write(buffer);

        myPort.write("\n\r");
        adapter.log.debug(sTemp);
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