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
var SendTimer = null;

var DataToSend = {};
var DataToSendLength = 0;
var IDX_DATENPUNKTE = 14;
var IDX_TYPE = 13;
var IDX_TARGET = 7;
var IDX_SOURCE = 1;
var IDX_START = 0;

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

    if (!SendTimer) {
        adapter.log.debug("init timer");
        var _SendTimer = setInterval(function () {
            SendData();
        },  10 * 1000);  //intervall evtl. einstellbar??
        SendTimer = _SendTimer;
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

            adapter.setObjectNotExists(id + "." + _state, {
                type: "state",
                common: {
                    name: _state,
                    type: "state",
                    role: "indicator.state",
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

function AddHeader() {
    DataToSend[IDX_START] = 0x00;
    DataToSend[IDX_SOURCE] = 0x10;  //source: meine ID 6Byte; zentrale
    DataToSend[IDX_SOURCE + 1] = 0x10;  //
    DataToSend[IDX_SOURCE + 2] = 0x10;  //
    DataToSend[IDX_SOURCE + 3] = 0x10;  //
    DataToSend[IDX_SOURCE + 4] = 0x10;  //
    DataToSend[IDX_SOURCE + 5] = 0x10;  //

    DataToSend[IDX_TARGET] = 0xFE;  //Target: Broadcast 6Byte
    DataToSend[IDX_TARGET + 1] = 0xFE;
    DataToSend[IDX_TARGET + 2] = 0xFE;
    DataToSend[IDX_TARGET + 3] = 0xFE;
    DataToSend[IDX_TARGET + 4] = 0xFE;
    DataToSend[IDX_TARGET + 5] = 0xFE;
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

}

function CheckDataLength() {
}


/*
Zeit/Datum-Telegramm
s 0  0  0  0  0  0  0  fe  fe  fe  fe  fe  fe  1 2 4 5 0 15 0  1 7 e1  0 5 6 0  e 0 37 0 22 0  -> HEX 0 als Absender
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 5 6 0 14 0 55 0 34  0 4 5 0 22 0  1 7 225 0 -> DEC Date/Time vertauscht
  0 16 16 16 16 16 16 254 254 254 254 254 254 16 2 4 5 0 22 0  1 7 225 0 5 6 0 14 0 55 0 34 0 -> DEC wie oben Zentrale als Absender
*/

function SendData() {
    //adapter.log.debug('Send data');

    try {
        AddHeader();
        AddDate();
        AddTime();
    }
    catch (e) {
        adapter.log.error('exception in  SendData [' + e + '] ');
    }
    sendSerialDataRaw();
}



function sendSerialDataRaw() {

    try {
        //var sTemp = "";
        myPort.write("s");

        var buffer = new Buffer(DataToSendLength+1);
        //copy into buffer for data conversion...
        for (var i = 0; i < DataToSendLength; i++) {
            buffer[i] = DataToSend[i];
            //sTemp += buffer[i];
            //sTemp += " ";
        }
        buffer[DataToSendLength] = 0x0D; //final return
        myPort.write(buffer);
        //adapter.log.debug(sTemp);
    }
    catch (e) {
        adapter.log.error('exception in  sendSerialDataRaw [' + e + ']');
    }
}





