# MeWo

A node-based WeMo emulator intended for use with the Amazon Echo. Largely ported from the python [fauxmo](https://github.com/makermusings/fauxmo).

# What?

MeWo is the jumping off point for building custom on/off home automation scripts in node. It provides an interface for connecting to an Amazon Echo and performing whatever tasks you want.

# Installation

You will need to be running node 6 or later as WeMo makes extensive use of ES6.

`npm install --save wemo`

# Example Usage

```javascript

const { UPnpBroadcastResponder, UPnpDevice } = require('wemo');

class MyUPnpDevice extends UPnpDevice {
  constructor() {
    // Super must be called
    super(...arugments);
  }

  // Called when "alexa turn 'device' on" is said
  on() {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  // Called when "alexa turn 'device' off" is said
  off() {
    return new Promise((resolve, reject) => {
      // Do something when the device is turned off
      resolve();
    });
  }
}

const responder = new UPnpBroadcastResponder();
responder.init({
  // These are the default options
  port: 1900,
  iface: 'eth0',
  multicastAddress: '239.11.3.8'
}).then(() => {
  // Create the new device with a name that will show up in the Alexa app
  const myDevice = new MyUPnpDevice('my-upnp-device');
  // Register with the UPnP responder
  responder.registerDevice(myDevice);
});
```