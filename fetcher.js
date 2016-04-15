var cluster = require('cluster');

if (cluster.isMaster) {
  console.log(new Date(), "Spawning worker...");
  cluster.fork();
  cluster.on('exit', function (worker) {
    console.error(new Date(), "Worker", worker.pid, "died");
    var newWorker = cluster.fork();
    console.log(new Date(), "Spawning new worker", newWorker.pid);
  });
} else {
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
