
# ioBroker.myHomeControl
===========================


This adapter implements interpretation of data received from Homecontrol sensor via RF.

 typical received data on HomeControl:
 	
	got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.03 C Press 959.00 mBar
		
	got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 29.00 lux
	
	got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.80 C Hum 38.30 %

protocol description for raw data can be found under
http://wiki.rg-engineering.eu/index.php?title=Funk-Protokoll

The system can be used for our sensors:
http://wiki.rg-engineering.eu/index.php?title=Umwelt-Funk-Sensor

 
The adapter is based on serialport 
https://github.com/EmergingTechnologyAdvisors/node-serialport/blob/4.0.1/README.md

For linux ARM system you need to compile serialport.
Just use 

 npm install serialport --build-from-source

as root

## Changelog

#### 0.0.15
* (René) Percentage of precipitation (PoP) to send added
* (René) update to serialport 5.0.0

#### 0.0.14
* (René) bug fixing

#### 0.0.13
* (René) 

#### 0.0.12
* (René) Configuration for display
	date to be sent are now objects and needs to be written from javascript or similar

#### 0.0.11
* (René) renamed to myHomeControl

#### 0.0.10
* (René) interpretes raw data instead of telegram, so we are more flexible in new data points; this needs a new version of firmware on Nano. It's not supported with CUL yet.

#### 0.0.9
* (René) new datapoint 'last update'

#### 0.0.8

#### 0.0.7
* (René)error telegarm added
		ignore sensor ID FFFFFFFFFFFF

#### 0.0.6
* (René)just cleanups

#### 0.0.5
* (René) supports HomeControl and CUL (with modified culfw)
		 available serial ports in admin page shown

#### 0.0.4
* (René) receive function optimized

#### 0.0.3
* (René) update to run under linux (debian) ARM system (Allwinner A10)

#### 0.0.2
* (René) initial release

## License


Copyright (C) <2017>  <info@rg-engineering.eu>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
