var config = require('./inc/config');
var request = require('request');
var schedule = require('node-schedule');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var Bus = require('./inc/bus');
var sequelize = new Sequelize(config.db.url);
var bus = new Bus(sequelize);

function is_int(val) {
  return (val === parseInt(val));
}

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
    var jobs = rows.map(function(row) {
      if(is_int((now - row.start) / row.interval)) {
        return now;
      }
    });
    console.log(jobs);
  });
});
