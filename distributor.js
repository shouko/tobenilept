var cluster = require('cluster');
var logger = require('./inc/logger')('logs/distributor.log');

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
  var Promise = require('bluebird');
  var Sequelize = require('sequelize');
  var Bus = require('./inc/bus');
  var Line = require('./inc/line');
  var sequelize = new Sequelize(config.db.url);
  var bus = new Bus(sequelize);
  var line = new Line(config.line.ChannelToken);

  function is_int(val) {
    return (val === parseInt(val));
  }

  var j = schedule.scheduleJob('0 * * * * *', function() {
    var now = new Date();
    now = 60 * now.getHours() + now.getMinutes();
    sequelize.query(
      'SELECT `subscription`.`mid` as `mid`, `route`.`name` as `route_name`, `stop`.`id` as `stop_id`, `stop`.`back` as `back`, `stop`.`name` as `stop_name`, `subscription`.`start` as `start`, `subscription`.`interval` as `interval` FROM `subscription`, `stop`, `route` WHERE  `stop`.`id` = `subscription`.`stop_id` AND `stop`.`route_id` = `route`.`id` AND ((`subscription`.`start` <= :now AND `subscription`.`end` >= :now) OR (`subscription`.`start` > `subscription`.`end` AND (`subscription`.`start` >= :now XOR `subscription`.`end` <= :now)))', {
        replacements: {
          now: now
        },
        type: sequelize.QueryTypes.SELECT
      }
    ).then(function(rows) {
      rows.forEach(function(row) {
        if(row.start > row.end) {
          row.end += 1440;
        }
        if(is_int((now - row.start) / row.interval)) {
          bus.estimate(row.stop_id).then(function(estimate) {
            var msg = "您所訂閱的 " + row.route_name + " 公車，";
            switch(row.estimate) {
              case -1:
                msg += "尚未發車";
                break;
              case -2:
                msg += "交管不停靠";
                break;
              case -3:
                msg += "末班車已過";
                break;
              case -4:
                msg += "今日未營運";
                break;
              default:
                msg += "即將在 " + parseInt(estimate/60) + "分鐘後到達";
                break;
            }
            msg += " " + row.stop_name + " 站";
            line.send(row.mid, msg);
          });
        }
      });
    });
  });
}
