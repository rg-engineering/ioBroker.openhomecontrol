
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
Copyright (C) <2016>  <info@rg-engineering.eu>

//

//    This program is free software: you can redistribute it and/or modify

//    it under the terms of the GNU General Public License as published by

//    the Free Software Foundation, either version 3 of the License, or

//    (at your option) any later version.

//

//    This program is distributed in the hope that it will be useful,

//    but WITHOUT ANY WARRANTY; without even the implied warranty of

//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the

//    GNU General Public License for more details.

//

//    You should have received a copy of the GNU General Public License

//    along with this program.  If not, see <http://www.gnu.org/licenses/>.




