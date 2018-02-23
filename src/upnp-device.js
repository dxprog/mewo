const bluebird = require('bluebird');
const freeport = bluebird.promisify(require('freeport'));
const http = require('http');
const render = require('./templating');
const url = require('url');
const uuid = require('node-uuid');

const BINARY_STATE = /\<BinaryState>([\d])\<\/BinaryState\>/;

const DISCOVERY_DEFAULTS = {
  namespace: 'MeWo',
  type: 'lightswitch'
};

function generateSerial(name) {
  const nameArr = name.split('');
  const idArr = nameArr.concat('mewo!'.split(''));
  return (nameArr.reduce((prev, curr) => (prev ? parseInt(prev) : 0) + curr.charCodeAt(0)) + idArr.reduce((prev, curr) => (prev ? parseInt(prev) : 0) + curr.charCodeAt(0))).toString(16);
}

module.exports = class UPnpDevice {
  constructor(name, responder, deviceOptions = {}) {
    this.deviceOptions = Object.assign({}, DISCOVERY_DEFAULTS, deviceOptions);
    this.name = name;
    this.serial = generateSerial(name);
    this.persistentUuid = `Socket-1_0-${this.serial}`;
    this.uuid = uuid.v4();
    this.responder = responder;
  }

  /**
   * Method that's called when an "on" event is received
   *
   * @abstract
   */
  on() {
    throw new Error('Abstract method "on" must be implemented');
  }

  /**
   * Method that's called when an "off" event is received
   *
   * @abstract
   */
  off() {
    throw new Error('Abstract method "off" must be implemented');
  }


  /**
   * Handles direct device requests from the Echo
   *
   * @param {http.IncomingMessage} req The incoming HTTP request
   * @param {http.ServerResponse} res The outgoing response
   */
  incomingRequest(req, res) {
    const headers = req.headers;
    const urlInfo = url.parse(req.url);
    if (urlInfo.path === '/setup.xml') {
      try {
        this.discoverRequest(res);
      } catch (exc) {
        this.log(`There was an issue sending discovery information: ${exc.message}`);
      }
    } else {
      this.parseRequest(req, res);
    }
  }

  /**
   * Receives the data for a non-discover request
   */
  parseRequest(req, res) {
    let data = [];
    req.on('data', (chunk) => {
      data.push(chunk);
    }).on('end', () => {
      const body = Buffer.concat(data).toString();
      this.handleRequest(body, res);
    });
  }

  /**
   * Handles a non-discover request
   */
  handleRequest(body, res) {
    const match = body.match(BINARY_STATE);
    try {
      (match[1] == '1' ? this.on() : this.off()).then((err) => {
        if (!err) {
          res.end();
        } else {
          res.statusCode = 500;
        }
        res.end();
      });
    } catch(exc) {
      this.error('There was an error setting the device state', exc);
      res.statusCode = 404;
      res.end();
    }
  }

  /**
   * Sends the request for device discovery
   */
  discoverRequest(res) {
    this.log('Responding with discovery information');
    res.writeHead(200, {
      'Content-Type': 'xml',
      'Server': this.responder.getVersion(),
      'X-User-Agent': 'redsonic',
      'Connection': 'close'
    });

    render('discover', Object.assign({}, this.deviceOptions, {
      name: this.name,
      persistentUuid: this.persistentUuid,
      serial: this.serial
    })).then(data => {
      res.write(data);
      res.end();
    }).catch(err => {
      this.error('There was an error rendering the discovery template', err);
    });
  }

  /**
   * Responds to a device search
   */
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

  /**
   * Starts the HTTP server
   */
  initServer(address, port = this.deviceOptions.port) {
    // Depending on whether a port was supplied, kick off the promise chain
    const promise = !port ? freeport() : Promise.resolve(port);
    return promise.then(port => {
      this.port = port;
      this.address = address;
      this.server = http.createServer(this.incomingRequest.bind(this));

      return new Promise((resolve, reject) => {
        this.server.listen(port, address, err => {
          if (err) {
            reject();
          } else {
            this.log(`Virtual device listening at http://${this.address}:${this.port}`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Generates the log stamp
   */
  getLogStamp() {
    const date = new Date();
    return `[${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${this.name}:${this.serial}]`;
  }

  /**
   * Wrapper around console.log that adds device/timestamp info
   *
   * @param Object[] params The parameters to log
   */
  log(...params) {
    console.log(this.getLogStamp(), ...params);
  }

  /**
   * Wrapper around console.error that adds device/timestamp info
   *
   * @param Object[] params The parameters to log
   */
  error(...params) {
    console.error(this.getLogStamp(), ...params);
  }
};
