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
var next_fetch = 200;
var empty_rounds = 0;

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
      if(length == 0) {
        empty_rounds++;
        next_fetch += 200 * empty_rounds;
      }
      schedule_fetch(next_fetch);
    });
  }, wait);
}

schedule_fetch(0);

function Member(mid) {
  this.mid = mid;
  this.params = [];
  this.next = actions.welcome;
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
  this.puts("以下是你的訂閱紀錄");
};

Member.prototype.add = function() {
  // add subscription to db
  this.puts('您的訂閱已完成');
};

Member.prototype.set_next = function(action) {
  this.next = parseInt(action);
};

Member.prototype.set_next_ra = function(action) {
  this.next_ra = parseInt(action);
};

Member.prototype.run = function() {
  try {
    console.log(Date(), this.mid, this.next, this.next_ra);
    switch(this.next) {
      case actions.welcome: {
        in_queue[this.mid].shift();
        this.puts(responses.main_menu);
        this.set_next_ra(actions.welcome_navigate);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.welcome_navigate: {
        console.log("params are", this.params);
        this.set_next(this.params[0]);
        this.run();
        break;
      }
      case actions.add_route: {
        this.puts(responses.ask_route);
        this.set_next_ra(actions.add_station);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.add_station: {
        this.puts(responses.ask_station);
        this.set_next_ra(actions.add_time);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.add_time: {
        this.puts(responses.ask_time);
        this.set_next_ra(actions.add_interval);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.add_interval: {
        this.puts(responses.ask_interval);
        this.set_next_ra(actions.add_proceed);
        this.set_next(actions.ask_param);
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
        this.params = [];
        break;
      }
      case actions.modify: {
        this.query();
        this.puts(responses.ask_modify);
        this.set_next_ra(actions.modify_navigate);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.modify_navigate: {
        this.next = modify_menu[this.params[1]];
        this.run();
        break;
      }
      case actions.modify_station: {
        this.puts(responses.ask_station)
        this.set_next_ra(actions.modify_proceed);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.modify_time: {
        this.puts(responses.ask_time)
        this.set_next_ra(actions.modify_proceed);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.modify_interval: {
        this.puts(responses.ask_interval)
        this.set_next_ra(actions.modify_proceed);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.modify_proceed: {
        // do dome modify job with params[2]
        this.puts(responses.succeed_modify);
        this.params = [];
        break;
      }
      case actions.delete: {
        this.query();
        this.puts(responses.ask_delete);
        this.set_next_ra(actions.delete_proceed);
        this.set_next(actions.ask_param);
        break;
      }
      case actions.delete_proceed: {
        // do dome delete job with params[1]
        this.puts(responses.succeed_modify);
        this.params = [];
        break;
      }
      case actions.ask_param: {
        this.params.push(in_queue[this.mid].shift());
        this.set_next(this.next_ra);
        this.run();
        break;
      }
      default:
        throw "UNKNOWN_ENTRY";
        break;
    }
  } catch(err) {
    console.log(err)
    this.set_next(actions.welcome);
    this.run();
  }
};
