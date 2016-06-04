const freeport = require('freeport');
const http = require('http');
const render = require('./templating');
const url = require('url');
const uuid = require('node-uuid');

function generateSerial(name) {
  const nameArr = name.split('');
  const idArr = nameArr.concat('mewo!'.split(''));
  return (nameArr.reduce((prev, curr) => (prev ? parseInt(prev) : 0) + curr.charCodeAt(0)) + idArr.reduce((prev, curr) => (prev ? parseInt(prev) : 0) + curr.charCodeAt(0))).toString(16);
}

module.exports = class UPnpDevice {
  constructor(name, responder) {
    this.name = name;
    this.serial = generateSerial(name);
    this.persistentUuid = `Socket-1_0-${this.serial}`;
    this.uuid = uuid.v4();
    this.responder = responder;
  }

  log(message) {
    console.log(`[${(new Date()).toUTCString()} ${this.name}:${this.serial}] ${message}`);
  }

  /**
   * Handles direct device requests from the Echo
   *
   * @param {http.IncomingMessage} req The incoming HTTP request
   * @param {http.ServerResponse} res The outgoing response
   */
  handleRequest(req, res) {
    const headers = req.headers;
    const urlInfo = url.parse(req.url);
    if (urlInfo.path === '/setup.xml') {
      try {
        this.discover(res);
      } catch (exc) {
        this.log(`There was an issue sending discovery information: ${exc.message}`);
      }
    } else {

    }
  }

  discover(res) {
    this.log('Responding with discovery information');
    res.writeHead(200, {
      'Content-Type': 'xml',
      'Server': this.responder.getVersion(),
      'X-User-Agent': 'redsonic',
      'Connection': 'close'
    });

    render('discover', { name: this.name, persistentUuid: this.persistentUuid }).then((data) => {
      console.log(data);
      res.write(data);
      res.end();
    }, (err) => {
      console.error('There was an error rendering the discovery template', err);
    });
  }

  initServer(address) {
    return new Promise((resolve, reject) => {
      freeport((err, port) => {
        this.port = port;
        this.address = address;
        this.server = http.createServer(this.handleRequest.bind(this));
        this.server.listen(port, address, (err) => {
          this.log(`Virtual device listening at http://${this.address}:${this.port}`);
          resolve();
        });
      });
    });
  }

  respondToSearch(sender, headers) {
    this.log(`Responding to search request`);
    const searchTarget = headers.ST;
    const date = (new Date()).toUTCString();
    const locationUrl = `http://${this.address}:${this.port}/setup.xml`;
    const message = [
      'HTTP/1.1 200 OK',
      'CACHE-CONTROL: max-age=86400',
      `DATE: ${date}`,
      'EXT:',
      `LOCATION: ${locationUrl}`,
      'OPT: "http://schemas.upnp.org/upnp/1/0"; ns=01',
      `01-NLS: ${this.uuid}`,
      `SERVER: ${this.responder.getVersion()}`,
      `ST: ${searchTarget}`,
      `USN: uuid:${this.persistentUuid}::${searchTarget}`
    ];
    this.responder.sendMessage(sender, message.join('\r\n') + '\r\n\r\n');
  }
};
