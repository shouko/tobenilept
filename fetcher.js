var cluster = require('cluster');
var logger = require('./inc/logger')('logs/fetcher.log');

if (cluster.isMaster) {
  logger.log('info', "Spawning worker...");
  cluster.fork();
  cluster.on('exit', function (worker) {
    logger.log('error', "died " + worker.pid);
    var newWorker = cluster.fork();
    logger.log('info', "spawn " + newWorker.pid);
  });
} else {
  process.on('uncaughtException', function (err) {
    logger.log('error', err.stack);
    process.exit();
  });

  var config = require('./inc/config');
  var schedule = require('node-schedule');
  var Sequelize = require('sequelize');
  var Bus = require('./inc/bus');
  var sequelize = new Sequelize(config.db.url);
  var bus = new Bus(sequelize);

  bus.fetch.route();
  bus.fetch.stop();
  bus.fetch.estimate();

  var fetch_estimate = schedule.scheduleJob('40 * * * * *', bus.fetch.estimate);
  var fetch_stop = schedule.scheduleJob('* * 4 * * *', bus.fetch.stop);
  var fetch_route = schedule.scheduleJob('* * 4 * * *', bus.fetch.route);
}
