![Logo](admin/myhomecontrol.png)
# ioBroker.myHomeControl
===========================

[![NPM version](https://img.shields.io/npm/v/iobroker.myhomecontrol.svg)](https://www.npmjs.com/package/iobroker.myhomecontrol)
[![Downloads](https://img.shields.io/npm/dm/iobroker.myhomecontrol.svg)](https://www.npmjs.com/package/iobroker.myhomecontrol)
[![Tests](https://travis-ci.org/rg-engineering/ioBroker.myhomecontrol.svg?branch=master)](https://travis-ci.org/rg-engineering/ioBroker.myhomecontrol)

[![NPM](https://nodei.co/npm/iobroker.myhomecontrol.png?downloads=true)](https://nodei.co/npm/iobroker.myhomecontrol/)


This adapter implements interpretation of data received from HomeControl sensor via RF.

protocol description for data can be found under
https://www.rg-engineering.eu/index.php/produkte/myhomecontrol/protokollbeschreibung

The system can be used with our sensors:
https://www.rg-engineering.eu/index.php/produkte/myhomecontrol

The sensors are Atmel based. Software is available in github
(link to do)


## Changelog

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
* (René)error telegarm added
		ignore sensor ID FFFFFFFFFFFF

### 0.0.6
* (René)just cleanups

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


Copyright (C) <2017-2018>  <info@rg-engineering.eu>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
