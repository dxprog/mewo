const UPnpBroadcastResponder = require('./src/upnp-broadcast-responder');
const UPnpDevice = require('./src/upnp-device');

const responder = new UPnpBroadcastResponder();
const device = new UPnpDevice('biteme', responder);
responder.init({
  iface: 'eth1'
}).then(() => {
  responder.registerDevice(device);
});