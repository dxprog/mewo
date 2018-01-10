const compile = require('handlebars').compile;
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '../templates');
const TEMPLATE_EXT = 'hbs';

global._templateCache = {};

module.exports = function render(templateName, data) {
  return new Promise((resolve, reject) => {
    // Check for the template in the global cache
    if (!global._templateCache[templateName]) {
      // Doesn't exist. Read the file, compile it, cache it, execute it
      const filePath = path.resolve(TEMPLATE_PATH, `${templateName}.${TEMPLATE_EXT}`);
      fs.readFile(filePath, (err, tpl) => {
        if (err) {
          reject(err);
        } else {
          try {
            const template = compile(tpl.toString());
            global._templateCache[templateName] = template;
            resolve(template(data));
          } catch (exc) {
            reject(exc);
          }
        }
      });
    } else {
      resolve(global._templateCache[templateName](data));
    }
  });
}