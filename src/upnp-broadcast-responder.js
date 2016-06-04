const dns = require('dns');
const dgram = require('dgram');
const os = require('os');
const UPnpDevice = require('./upnp-device');

/**
 * Tries to determine the IP address of this machine
 */
function getIpAddress(iface) {
  let retVal = null;
  const interfaces = os.networkInterfaces();
  if (!!interfaces[iface]) {
    // Pluck out the first IPv4 addy found
    const ipv4 = interfaces[iface].find((iface) => iface.family === 'IPv4');
    if (ipv4) {
      retVal = ipv4.address;
    }
  }
  return retVal;
}

module.exports = class UPnpBroadcastResponder {
  constructor() {
    this.devices = [];
  }

  init({ port = 1900, multicastAddress = '239.11.3.8', iface = 'eth0' } = {}) {
    return new Promise((resolve, reject) => {
      let ipAddress = getIpAddress(iface);
      this.address = ipAddress === null ? '0.0.0.0' : ipAddress;
      const socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
      });
      socket.on('message', this.messageHandler.bind(this));
      socket.bind(port, () => {
        socket.addMembership(multicastAddress);
        console.log(`Server listening on port ${port}`);
        this.socket = socket;
        resolve();
      });
    });
  }

  /**
   * Intercepts and processes messages
   */
  messageHandler(message, remote) {
    const lines = message.toString().trim().split('\r\n');
    const action = lines.shift().split(' ');
    const method = action.shift();
    const protocol = action.pop();
    const path = action.join(' ');
    const headers = {};
    lines.forEach((content) => {
      content = content.split(':');
      const key = content.shift().trim();
      headers[key] = content.join(':').trim();
    });

    switch (method.toLowerCase()) {
      case 'm-search':
        if (headers['ST'] === 'urn:Belkin:device:**') {
          console.log('Responding to M-SEARCH');
          this.devices.forEach((device) => device.respondToSearch(remote, headers));
        }
        break;
      case 'get':
        this.devices.forEach((device) => device.get(remote, path, headers));
        break;
    }
  }

  sendMessage(target, message) {
    message = Buffer.from(message);
    this.socket.send(message, target.port, target.address, (err) => {
      if (err) {
        console.error('There was an error sending the message', err);
      }
    });
  }

  registerDevice(device) {
    if (device instanceof UPnpDevice) {
      device.initServer(this.address).then(() => {
        this.devices.push(device);
        console.log(`Device ${device.name} [${device.serial}] registered`);
      });
    } else {
      throw new Error('Cannot add non-upnp device');
    }
  }

  getVersion() {
    return 'Unspecified, UPnP/1.0, Unspecified';
  }

  getAddress() {
    return this.socket.address();
  }
};