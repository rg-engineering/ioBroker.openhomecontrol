/*
 * homecontrol adapter für iobroker
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
var adapter = utils.adapter('homecontrol');




var myPort = null;
var receivedData = "";
var SendTimerBroadcast = null;
var SendTimer2Display = null;

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

    adapter.log.info('port created; portname: ' + options.serialport + ' ' + myPort.comName + ' ' + myPort.pnpId + ' ' + myPort.manufacturer + ' Data rate: ' + myPort.options.baudRate + ' ' + options.baudrate);

    myPort.on('open', showPortOpen);
    myPort.on('data', receiveSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);

    if (adapter.config.device == "CUL") {
        adapter.log.info("CUL used");
    }
    else if (adapter.config.device == "HomeControl") {
        adapter.log.info("HomeControl used");
    }
    else {
        adapter.log.warn("unknown device");
    }

    if (!SendTimerBroadcast) {
        adapter.log.debug("init timer");
        var _SendTimerBroadcast = setInterval(function () {
            SendDataBroadcast();
        }, 10 * 1000);  //intervall evtl. einstellbar??
        SendTimerBroadcast = _SendTimerBroadcast;
    }
    if (!SendTimer2Display) {
        var _SendTimer2Display = setInterval(function () {
            SendData2Display();
        }, 30 * 1000);  //intervall evtl. einstellbar??
        SendTimer2Display = _SendTimer2Display;
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
            else if (adapter.config.device == "HomeControl") {
                //send configuration to nano
                if (adapter.config.mode == "telegram") {
                    myPort.write("mi");
                    myPort.write(0x0D);
                }
                else
                    if (adapter.config.mode == "raw data") {
                        myPort.write("mr");
                        myPort.write(0x0D);
                    }
                    else {
                        adapter.log.error('unknown receive mode');
                    }
            }
		}
	}

    catch (e) {
        adapter.log.error('exception in  showPortOpen [' + e + ']');
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
    else if (adapter.config.device == "HomeControl" && adapter.config.mode == "telegram") {
        // filter out everyting not needed...
        // if got data not in then drop message

        if (receivedData.indexOf("too long") >= 0) {
            receivedData = "";
            adapter.log.error('message to sender too long');
            return;
        }

        if (receivedData.indexOf("data from") <= 0) {

            receivedData = "";
            return;
        }

    }

    if (adapter.config.mode == "telegram") {
        receiveSerialDataTelegram(receivedData);
    }
    else
        if (adapter.config.mode == "raw data") {
            //receiveSerialDataRaw(receivedData);
        }
        else {
            adapter.log.error('unknown receive mode');
        }
}

//this will be the new function to interprete raw data sent by nano
//for that we create a new class rfsensorpacket which can also be used to send data
function receiveSerialDataRaw(data) {
    receivedData = "";
}

//this is the obsolete old function which will be removed in one of the next releases
//here we need to interprete telegram data on nano. Nano sends then a interpreted telegram like:
//got data from Sensor :3FAF82180000 with 2 DP as broadcast Temp 30.64 C Press 958.32 mBar
function receiveSerialDataTelegram(data) {

    try {
        var res = data.split(" ");
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

function AddHeader(target) {
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
        //98EF82180000
        DataToSend[IDX_TARGET] = 0x98;  //Target: Display 6Byte
        DataToSend[IDX_TARGET + 1] = 0xEF;
        DataToSend[IDX_TARGET + 2] = 0x82;
        DataToSend[IDX_TARGET + 3] = 0x18;
        DataToSend[IDX_TARGET + 4] = 0x00;
        DataToSend[IDX_TARGET + 5] = 0x00;
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

    //erwartet
    //0 16 == 0000 0000 0001 0110 = 22  
    //0 1  == 0000 0000 0000 0001 = 1
    //7 e1 == 0000 0111 1110 0001 = 2017

    //ist
    //0 16 == 22 ==   0000 0000 0001 0110
    //0 0 == 0 ==     0000 0000 0000 0000   // erwartet 1 == 0 1 = 0000 0001
    //f e1 == 4065 == 0000 1111 1110 0001 //erwartet 2017 = 7 e1

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

function AddTemperature() {
    try {
        adapter.getForeignState('hm-rpc.0.KEQ0766678.1.TEMPERATURE', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
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

                AddHumidity();

            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddTemperature [' + e + ']');
    }
}

function AddHumidity() {
    try {
        adapter.getForeignState('hm-rpc.0.KEQ0766678.1.HUMIDITY', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
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

                AddAirPressure();
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddHumidity [' + e + ']');
    }
}

function AddAirPressure() {
    try {
        adapter.getForeignState('homecontrol.0.CE1283180000.Press', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
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
                AddWeatherIconId();
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in  AddAirPressure [' + e + ']');
    }
}

function AddWeatherIconId() {
    try {
        adapter.getForeignState('weatherunderground.0.forecast_day.1d.icon', function (err, obj) {
            if (err) {
                adapter.log.error(err);
                AlreadySending = false;
            } else {
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
                        adapter.log.error('unknown WeatherIcon ' + icon );
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
        AddHeader(0xFE);
        AddDate();
        AddTime();
    }
    catch (e) {
        adapter.log.error('exception in  SendData [' + e + '] ');
    }
    sendSerialDataRaw(); 
}

function SendData2Display() {
    //adapter.log.debug('Send data');
    if (AlreadySending)
        return;

    AlreadySending = true;
    try {
        AddHeader(0x00);
        AddTemperature(); //from there we add humidity and then air pressure; don't do it here because it's asynchron call
    }
    catch (e) {
        adapter.log.error('exception in  SendData [' + e + '] ');
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
        buffer[DataToSendLength] = 0x0D; //final return
        myPort.write(buffer);
        adapter.log.debug(sTemp);
    }
    catch (e) {
        adapter.log.error('exception in  sendSerialDataRaw [' + e + ']');
    }
    AlreadySending = false;
}




/*
var hex2double = function (input) {

    var hi = parseInt(input.substring(0, 8), 16);
    var lo = parseInt(input.substring(8), 16);

    var p32 = 0x100000000;
    var p52 = 0x10000000000000;

    var exp = (hi >> 20) & 0x7ff;
    var sign = (hi >> 31);
    var m = 1 + ((hi & 0xfffff) * p32 + lo) / p52;
    m = exp ? (m + 1) : (m * 2.0);

    return (sign ? -1 : 1) * m * Math.pow(2, exp - 1023);
};
*/

/*

Wetterstation
url.setUrl("http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/lang:DL/q/Germany/Neumark.xml");
url.setUrl("http://api.wunderground.com/api/fe3fbb0aa338493c/hourly/lang:DL/q/Germany/Neumark.xml");
url.setUrl("http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/hourly/lang:DL/q/Germany/Neumark.xml");
url.setUrl("http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/hourly/lang:DL/q/Germany/"+sStation+".xml");
stemp= "http://api.wunderground.com/api/" + sLicense + "/forecast/hourly/lang:DL/q/Germany/" + sStation + ".xml";
http://api.wunderground.com/api/fe3fbb0aa338493c/hourly/lang:DL/q/Neumark.json
http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/hourly/lang:DL/q/Germany/Neumark.xml
http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/hourly/lang:DL/q/Germany/Neumark.json

var parseString = require('xml2js').parseString;
var xml = '<?xml version="1.0" encoding="UTF-8" ?><business><company>Code Blog</company><owner>Nic Raboy</owner><employee><firstname>Nic</firstname><lastname>Raboy</lastname></employee><employee><firstname>Maria</firstname><lastname>Campos</lastname></employee></business>';
parseString(xml, function (err, result) {
    console.dir(JSON.stringify(result));
});
*/

/*
function GetWeatherData() {
    try {
        adapter.log.debug('GetWeatherData');
        //Lizenz und Station einstellbar...
        request('http://api.wunderground.com/api/fe3fbb0aa338493c/forecast/hourly/lang:DL/q/Germany/Neumark.xml', function (error, response, body) {
            if (!error && response.statusCode == 200) {
                //log("Body: " + body + response.statusCode);

                var weather = xmlparser.toJson(body);
                adapter.log.debug(weather);

            } else {
                adapter.log.error(error);
            }
        });

    }
    catch (e) { console.error(e); }
}
*/

