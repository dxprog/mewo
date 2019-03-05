const { UPnpBroadcastResponder, MeWoDevice } = require('./index');

class MyUPnpDevice extends MeWoDevice {
  constructor(...args) {
    // Super must be called
    super(...args);
  }

  // Called when "alexa turn 'device' on" is said
  on() {
    return new Promise((resolve, reject) => {
      console.log('clap on');
      resolve();
    });
  }

  // Called when "alexa turn 'device' off" is said
  off() {
    return new Promise((resolve, reject) => {
      // Do something when the device is turned off
      console.log('clap off');
      resolve();
    });
  }
}

const responder = new UPnpBroadcastResponder();
responder.init({
  // These are the default options
  port: 1900,
  iface: 'eth1',
  multicastAddress: '239.11.3.8'
}).then(() => {
  // Create the new device with a name that will show up in the Alexa app
  const myDevice = new MyUPnpDevice('my dimmer', responder);

  // Register with the UPnP responder
  responder.registerDevice(myDevice);
});