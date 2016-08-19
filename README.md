
# ioBroker.homecontrol
===========================

This adapter implements interpretation of data received from Homecontrol sensor via RF
and cul.

It needs a modified culfw (see https://github.com/rg-engineering/culfw4CUL_HomeControl).
The HomeControl sensor sends temperature, hunidity, air pressure and brightness via
CC1101.

typical received data are:

  got data from Sensor :CE1283180000 with 1 DP as broadcast Bright 250 lux
  
  got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.80 C Hum 57.50 %
  
  got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.67 C Press 962.35 mBar
   
  got data from Sensor :CE1283180000 with 2 DP as broadcast Temp 24.66 C Press 962.33 mBar 
  



## Changelog



#### 0.2.0
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




