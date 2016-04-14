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

var fetch_estimate = schedule.scheduleJob('40 * * * * *', bus.fetch.estimate);
var fetch_stop = schedule.scheduleJob('* * 4 * * *', bus.fetch.stop);
var fetch_route = schedule.scheduleJob('* * 4 * * *', bus.fetch.route);

bus.fetch.route();
bus.fetch.stop();
bus.fetch.estimate();

var j = schedule.scheduleJob('0 * * * * *', function() {
  var now = new Date();
  now = 60 * now.getHours() + now.getMinutes();
  sequelize.query(
    'SELECT `subscription`.`mid` as `mid`, `route`.`name` as `route_name`, `stop`.`back` as `back`, `stop`.`name` as `stop_name`, `stop`.`estimate` as `estimate`, `subscription`.`start` as `start`, `subscription`.`interval` as `interval` FROM `subscription`, `stop`, `route` WHERE `subscription`.`start` < :now AND `subscription`.`end` > :now AND `stop`.`id` = `subscription`.`stop_id` AND `stop`.`route_id` = `route`.`id`', {
      replacements: {
        now: now
      },
      type: sequelize.QueryTypes.SELECT
    }
  ).then(function(rows) {
    rows.forEach(function(row) {
      if(is_int((now - row.start) / row.interval)) {
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
            msg += "即將在 " + row.estimate + "分鐘後到達";
            break;
        }
        msg += " " + row.stop_name + " 站";
        line.send(row.mid, msg);
      }
    });
  });
});
