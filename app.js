var config = require('./config');
var actions = require('./actions');
var responses = require('./responses');
var request = require('request');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var sequelize = new Sequelize(config.db.url);
var modify_menu = {
  1: 31,
  2: 32,
  3: 33
};

var in_queue = new Array();
var members = new Array();
var fetched = 0;

function fetch() {
  return new Promise(function(resolve, reject) {
    sequelize.query(
      'SELECT `id`, `mid`, `payload` FROM `message` WHERE `id` > :id AND `done` = 0', {
        replacements: {
          id: fetched
        },
        type: sequelize.QueryTypes.SELECT
      }
    ).then(function(messages) {
      Promise.all([
        new Promise(function(resolve, reject) {
          if(messages.length > 0) {
            fetched = messages[messages.length - 1].id;
            console.log("max fetched id", fetched);
            sequelize.query(
              'UPDATE `message` SET `done` = 1 WHERE `id` <= :id', {
                replacements: {
                  id: fetched
                },
                type: sequelize.QueryTypes.UPDATE
              }
            ).then(function(results) {
              resolve();
            });
          } else {
            resolve();
          }
        }),
        new Promise(function(resolve, reject) {
          messages.forEach(function(element, index, array) {
            if(typeof(in_queue[element.mid]) == "undefined" || typeof(members[element.mid]) == "undefined") {
              in_queue[element.mid] = new Array();
              members[element.mid] = new Member(element.mid);
            }
            in_queue[element.mid].push(element.payload);
            members[element.mid].run();
          });
          resolve();
        })
      ]).then(function() {
        resolve(messages.length);
      });
    });
  });
}

function schedule_fetch(wait) {
  setTimeout(function() {
    fetch().then(function(length) {
      console.log(Date(), 'fetched', length);
      var next_fetch = 100;
      if(length == 0) {
        next_fetch = 500;
      }
      schedule_fetch(next_fetch);
    });
  }, wait);
}

schedule_fetch(0);

function Member(mid) {
  this.mid = mid;
  this.params = [];
  this.jas = new Array();
  this.jas_push(actions.welcome);
  console.log(Date(), "create", mid);
}

Member.prototype.gets = function() {
  return in_queue[this.mid].shift();
};

Member.prototype.puts = function(msg) {
  console.log(Date(), 'puts', msg);
  var data = {
    to: [ this.mid ],
    toChannel: 1383378250,
    eventType: "138311608800106203",
    content: {
      contentType: 1,
      toType: 1,
      text: msg
    }
  };
  request({
    method: 'POST',
    url: 'https://api.line.me/v1/events',
    headers: {
      'X-LINE-ChannelToken': config.line.ChannelToken
    },
    json: data
  }, function(err, response, body) {
    if(err) {
      console.log(Date(), err, data);
    }
    console.log(Date(), body.messageId, body.timestamp);
  });
};

Member.prototype.query = function() {
  // fetch subscription record
  sequelize.query(
    'SELECT * FROM `subscription` WHERE `mid` = :mid', {
      replacements: {
        mid: this.mid
      },
      type: sequelize.QueryTypes.SELECT
    }
  ).then(function(rows) {
    this.puts("以下是你的訂閱紀錄");
  });
  this.params = [];
};

Member.prototype.add = function() {
  // add subscription to db
  this.puts('您的訂閱已完成');
};

Member.prototype.edit = function() {
  this.params = [];
};

Member.prototype.delete = function() {
  this.params = [];
};

Member.prototype.jas_push = function(action) {
  this.jas.push(parseInt(action));
};

Member.prototype.run = function() {
  try {
    console.log(Date(), this.mid, this.jas[this.jas.length - 1], this.jas[this.jas.length - 2]);
    switch(this.jas.pop()) {
      case actions.welcome: {
        in_queue[this.mid].shift();
        this.puts(responses.main_menu);
        this.jas_push(actions.welcome_navigate);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.welcome_navigate: {
        console.log("params are", this.params);
        this.jas_push(this.params[0]);
        this.run();
        break;
      }
      case actions.add_route: {
        this.puts(responses.ask_route);
        this.jas_push(actions.add_station);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.add_station: {
        this.puts(responses.ask_station);
        this.jas_push(actions.add_time);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.add_time: {
        this.puts(responses.ask_time);
        this.jas_push(actions.add_interval);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.add_interval: {
        this.puts(responses.ask_interval);
        this.jas_push(actions.add_proceed);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.add_proceed: {
        // proceed add action with params
        this.puts(responses.succeed_add);
        this.params = [];
        break;
      }
      case actions.query: {
        this.query();
        break;
      }
      case actions.modify: {
        this.query();
        this.puts(responses.ask_modify);
        this.jas_push(actions.modify_navigate);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.modify_navigate: {
        this.jas_push(modify_menu[this.params[1]]);
        this.run();
        break;
      }
      case actions.modify_station: {
        this.puts(responses.ask_station)
        this.jas_push(actions.modify_proceed);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.modify_time: {
        this.puts(responses.ask_time)
        this.jas_push(actions.modify_proceed);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.modify_interval: {
        this.puts(responses.ask_interval)
        this.jas_push(actions.modify_proceed);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.modify_proceed: {
        // do dome modify job with params[2]
        this.puts(responses.succeed_modify);
        break;
      }
      case actions.delete: {
        this.query();
        this.puts(responses.ask_delete);
        this.jas_push(actions.delete_proceed);
        this.jas_push(actions.ask_param);
        break;
      }
      case actions.delete_proceed: {
        // do dome delete job with params[1]
        this.puts(responses.succeed_modify);
        break;
      }
      case actions.ask_param: {
        this.params.push(in_queue[this.mid].shift());
        this.run();
        break;
      }
      default:
        throw "UNKNOWN_ENTRY";
        break;
    }
  } catch(err) {
    console.log(err)
    this.jas_push(actions.welcome);
    this.run();
  }
};
