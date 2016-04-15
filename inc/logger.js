var winston = require('winston');

module.exports = function(filename) {
  return new (winston.Logger)({
    transports: [
      new (winston.transports.Console)( timestamp: true, level: 'info' ),
      new (winston.transports.File)({ timestamp: true, filename: filename, level: 'error' })
    ]
  });
};
