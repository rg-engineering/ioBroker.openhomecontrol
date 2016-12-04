"use strict";

var myPort = null;

try {
    var SerialPort = require('serialport');
} catch (e) {
    console.warn('Serial port is not installed');
}



 try {
        myPort = new SerialPort('/dev/ttyACM0', {
            baudRate: 115200
        });

    } catch (e) {
        console.warn('Serial port is not created');
    }


    myPort.on('open', showPortOpen);
    myPort.on('data', sendSerialData);
    myPort.on('close', showPortClose);
    myPort.on('error', showError);




function showPortOpen() {
	
	try{
		    if (myPort != null) {
		    	console.info('port open. ');
		        myPort.write("V\n\r");
		        myPort.write("hr\n\r");
		    }
	   }

    catch (e) {
    	console.error('exception in  showPortOpen [' + e + ']');
    }
}





function sendSerialData(data) {
    var sdata = data.toString();

    if (sdata.length < 2) {
        return;
    }

    if (sdata.includes("receive off")) {
    	console.info('port reopen. ');
        
        	myPort.write("V\n\r");
        	myPort.write("hr\n\r");
       
        return;
    }
    if (sdata.includes("receive on")) {

        return;
    }

    console.log(sdata);
}

function showPortClose() {
	console.log('port closed.');
}

function showError(error) {
	console.error('Serial port error: ' + error);
}