
# ioBroker.homecontrol
===========================

This adapter implements interpretation of data received from Homecontrol sensor via RF
and cul.

It needs a modified culfw (see https://github.com/rg-engineering/culfw4CUL_HomeControl).
The HomeControl sensor sends temperature, hunidity, air pressure and brightness via
CC1101.

typical received data are on CUL:

  	got data from Sensor :CE1283180000 with 1 DP as broadcast Bright 250 lux
  
  	got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.80 C Hum 57.50 %
  
  	got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.67 C Press 962.35 mBar
   
  	got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.66 C Press 962.33 mBar 
  
 typical received data are on HomeControl:
 	
	got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 31.03 C Press 959.00 mBar
		
	got data from Sensor: 3FAF82820000 as broadcast with 1 DP Bright 29.00 lux
	
	got data from Sensor: 3FAF82820000 as broadcast with 2 DP Temp 30.80 C Hum 38.30 %
	
 
The adapter is based on serialport 
https://github.com/EmergingTechnologyAdvisors/node-serialport/blob/4.0.1/README.md

For linux ARM system you need to compile serialport.
Just use 

 npm install serialport --build-from-source

as root

## Changelog

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




