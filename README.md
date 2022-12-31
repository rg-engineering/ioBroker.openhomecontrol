![Logo](admin/openhomecontrol.png)
# ioBroker.OpenHomeControl

![Number of Installations](http://iobroker.live/badges/openhomecontrol-installed.svg) ![Number of Installations](http://iobroker.live/badges/openhomecontrol-stable.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.openhomecontrol.svg)](https://www.npmjs.com/package/iobroker.openhomecontrol)
[![NPM version](http://img.shields.io/npm/v/iobroker.openhomecontrol.svg)](https://www.npmjs.com/package/iobroker.openhomecontrol)

[![Known Vulnerabilities](https://snyk.io/test/github/rg-engineering/ioBroker.openhomecontrol/badge.svg)](https://snyk.io/test/github/rg-engineering/ioBroker.openhomecontrol)
![GitHub Actions](https://github.com/rg-engineering/ioBroker.openhomecontrol/workflows/Test%20and%20Release/badge.svg)

[![NPM](https://nodei.co/npm/iobroker.openhomecontrol.png?downloads=true)](https://nodei.co/npm/iobroker.openhomecontrol/)


**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** 
For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.


**If you like it, please consider a donation:**
                                                                          
[![paypal](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YBAZTEBT9SYC2&source=url)


Implementation of open protocol to control different sensors, actors and visualisation devices.
The devices must be connected to serial port. The adapter reads data from serial port. 

A implementation of RF transceiver based on Atmel Atmega328p and CC1101 is available. We also provide
sample implementation of environemant sensor based on Atmel Atmega Atmega328p and a Display based on Atmel Atmega644

Everytime a new device is recognized it will be added to a list in admin page only. If you enable that device in admin the adapter creates
datapoints and will update datapoints whenever new telegram will be received.

With broadcast function adapter sends date and time information to every device. Device can use that information if needed.

### protocol

#### general

| Byte    | description                    | length  | 
|---------|--------------------------------|---------|
| 0 	  | Start-Byte                     | 1 Byte  |
| 1 - 6   | source ID                      | 6 Byte  |
| 7 - 12  | target ID                      | 6 Byte  |
|         |	0xFE for broadcast             |         |
|         |	0x10 for central receiver      |         |
| 13      | modul type                     | 1 Byte  |
|         |	0x01 sensor                    |         | 
|         |	0x02 actor                     |         |
|         |	0x03 display                   |         |
|         |	0x10 central station           |         |
| 14      | number of following datapoints | 1 Byte  |

#### datapoint

| Byte 	  |	description             |
|---------|-------------------------|
| 0		  |	type of datapoint       |
|         |	0x01 temperature        |
|         |	0x02 hunidity           |
|         |	0x03 air quality        |
|         |	0x04 date               |
|         |	0x05 time               |
|         |	0x06 brightness         |
|         |	0x07 battery state      |
|         |	0x08 sabotage           |
|         |	0x09 air pressur        |
|         |	0x0A error message      |
|         |	0x0B Weather Icon       |
|         |	0x0C cance of rain      |
|         |	0x0D average wind speed |
|         |	0x0E wind gust          |
|         |	0x0F wind direction     |
|         | 0x10 Rain Forecast      |
|         | 0x11 Temperature Forecast|
|         | 0x12 Rain               |
| 1       |	type of data            |
|         |	0x01 Byte               | 
|         |	0x02 int                |
|         |	0x03 float              |
|         |	0x04 string             |
|         |	0x05 date               |
|         |	0x06 time               |
| 2 - n	  |	data                    |
| n + 1	  |	unit                    |
|         |	0x00 without            |
|         |	0x01 °C                 |
|         |	0x02 %                  |
|         |	0x03 mBar               |
|         |	0x04 lux                |
|         |	0x05 m/s                |
|         |	0x06 deg                |
|         |	0x07 mm                 |

## known issues
* please create issues at [github](https://github.com/rg-engineering/ioBroker.openhomecontrol/issues) if you find bugs or whish new features


## Changelog

### 1.2.8 (in progress)
* (René) update of dependencies

### 1.2.7 (2022-08-18)
* (René) update of dependencies

### 1.2.6 (2021-11-07)
* (René) bug fix: type of datapoint

### 1.2.5 (2021-07-08)
* (René) bug fix: remove warning regarding wrong datatype with js-controller 3.3
* (René) dependencies updated

### 1.2.1 (2021-03-21)
* (René) dependencies updated

### 1.2.0 (2020-07-20)
* (René) add new device to list only if device type is valid
* (René) show last update of device in admin

### 1.1.0 (2020-06-15)
* (René) handling if port is not created

### 1.0.0 (2019-05-01)
* (René) first public release version

### 0.0.20 (2019-01-08)
* (René) support of compact mode

### 0.0.19

### 0.0.18
* (René) support only for HomeControl raw data
* (René) new devices are shown in admin and needs to be confirmed before they are used as objects
* (René) update to admin3

### 0.0.17
* (René) update serial port lib

### 0.0.16
* (René) protocol extension: wind average speed, wind gust and wind direction added

### 0.0.15
* (René) Percentage of precipitation (PoP) to send added
* (René) update to serialport 5.0.0

### 0.0.14
* (René) bug fixing

### 0.0.13
* (René) 

### 0.0.12
* (René) Configuration for display
	date to be sent are now objects and needs to be written from javascript or similar

### 0.0.11
* (René) renamed to myHomeControl

### 0.0.10
* (René) interpretes raw data instead of telegram, so we are more flexible in new data points; this needs a new version of firmware on Nano. It's not supported with CUL yet.

### 0.0.9
* (René) new datapoint 'last update'

### 0.0.8

### 0.0.7
* (René) error telegarm added
		ignore sensor ID FFFFFFFFFFFF

### 0.0.6
* (René) just cleanups

### 0.0.5
* (René) supports HomeControl and CUL (with modified culfw)
		 available serial ports in admin page shown

### 0.0.4
* (René) receive function optimized

### 0.0.3
* (René) update to run under linux (debian) ARM system (Allwinner A10)

### 0.0.2
* (René) initial release

## License
MIT License

Copyright (c) 2017-2023 rg-engineering info@rg-engineering.eu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.