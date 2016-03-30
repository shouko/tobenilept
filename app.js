var config = require('./config');
var actions = require('./actions');
var responses = require('./responses');
var request = require('request');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var Bus = require('./bus');
var sequelize = new Sequelize(config.db.url);
var bus = new Bus(sequelize);
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
  this.ra = 0;
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
  console.log("params", this.params);
  this.params = [];
};

Member.prototype.edit = function() {
  console.log("params", this.params);
  this.params = [];
};

Member.prototype.delete = function() {
  console.log("params", this.params);
  this.params = [];
};

Member.prototype.jas_push = function(action) {
  this.jas.push(parseInt(action));
};

Member.prototype.jas_clear = function() {
  this.jas = [];
}

Member.prototype.jas_set = function(action) {
  this.jas_clear();
  this.jas_push(action);
}

Member.prototype.ra_set = function(action) {
  this.ra = parseInt(action);
}

Member.prototype.beq = function(verify, success, fail) {
  this.jas_push(success);
  this.jas_push(verify);
  this.jas_push(actions.ask_param);
  this.ra_set(fail);
}

Member.prototype.run = function() {
  var self = this;
  try {
    console.log(Date(), self.mid, self.jas[self.jas.length - 1], self.jas[self.jas.length - 2]);
    switch(self.jas.pop()) {
      case actions.welcome: {
        in_queue[self.mid].shift();
        self.puts(responses.main_menu);
        self.jas_push(actions.welcome_navigate);
        self.jas_push(actions.ask_param);
        break;
      }
      case actions.welcome_navigate: {
        console.log("params are", self.params);
        self.jas_push(self.params[0]);
        self.run();
        break;
      }
      case actions.add_route: {
        self.puts(responses.ask_route);
        self.beq(actions.verify_route, actions.add_back, actions.add_route);
        break;
      }
      case actions.add_back: {
        self.puts(responses.ask_back);
        self.beq(actions.verify_back, actions.add_stop, actions.add_back);
        break;
      }
      case actions.add_stop: {
        self.puts(responses.ask_stop);
        self.beq(actions.verify_stop, actions.add_time, actions.add_stop);
        break;
      }
      case actions.add_time: {
        self.puts(responses.ask_time);
        self.beq(actions.verify_time, actions.add_interval, actions.add_time);
        break;
      }
      case actions.add_interval: {
        self.puts(responses.ask_interval);
        self.beq(actions.verify_interval, actions.add_proceed, actions.add_interval);
        break;
      }
      case actions.add_proceed: {
        // proceed add action with params
        self.add();
        self.puts(responses.suceed_add);
        break;
      }
      case actions.query: {
        self.query();
        break;
      }
      case actions.modify: {
        self.query();
        self.jas_push(actions.modify_item);
        self.run();
        break;
      }
      case actions.modify_item: {
        self.puts(responses.ask_modify);
        self.beq(actions.verify_item, actions.modify_navigate, actions.modify_item);
      }
      case actions.modify_navigate: {
        self.jas_push(modify_menu[self.params[1]]);
        self.run();
        break;
      }
      case actions.modify_stop: {
        self.puts(responses.ask_stop)
        self.beq(actions.verify_stop, actions.modify_proceed, actions.modify_stop);
        break;
      }
      case actions.modify_time: {
        self.puts(responses.ask_time)
        self.beq(actions.verify_time, actions.modify_proceed, actions.modify_time);
        break;
      }
      case actions.modify_interval: {
        self.puts(responses.ask_interval)
        self.beq(actions.verify_interval, actions.modify_proceed, actions.modify_interval);
        break;
      }
      case actions.modify_proceed: {
        // do dome modify job with params[2]
        self.modify();
        self.puts(responses.succeed_modify);
        break;
      }
      case actions.delete: {
        self.query();
        self.puts(responses.ask_delete);
        self.beq(actions.verify_item, actions.delete_proceed, actions.delete);
        break;
      }
      case actions.delete_proceed: {
        // do dome delete job with params[1]
        self.delete();
        self.puts(responses.succeed_modify);
        break;
      }
      case actions.verify_route: {
        bus.search.route(self.params.pop()).then(function(rows) {
          if(rows.length == 0) {
            self.jas_set(self.ra);
          } else {
            self.params.push(rows[0]['id']);
          }
          self.run();
        });
        break;
      }
      case actions.verify_back: {
        var back = self.params.pop();
        if([0, '0', 'n', 'N', '否', '不是'].indexOf(back) !== -1) {
          this.params.push(0);
        } else if([1, '1', 'y', 'Y', '是'].indexOf(back) !== -1) {
          this.params.push(1);
        } else {
          self.jas_set(self.ra);
        }
        self.run();
        break;
      }
      case actions.verify_stop: {
        var stop_name = self.params.pop();
        var back = self.params.pop();
        var route_id = self.params[self.params.length - 1];
        bus.search.stop(stop_name, back, route_id).then(function(rows) {
          if(rows.length == 0) {
            self.puts(responses.verify_stop);
            self.params.push(back);
            self.jas_set(self.ra);
          } else {
            self.params.push(rows[0]['id']);
          }
          self.run();
        });
        break;
      }
      case actions.verify_time: {
        var time = self.params.pop().split('-');
        var fail = 0;
        if(time.length == 2) {
          time.forEach(function(elem) {
            if(!/([0-1][0-9]|2[0-3])[0-5][0-9]/.test(elem)) {
              fail = 1;
            }
          });
        } else {
          fail = 1;
        }
        if(fail == 1) {
          self.puts(responses.verify_time);
          self.jas_set(self.ra)
        } else {
          self.params.push(time);
        }
        self.run();
        break;
      }
      case actions.verify_interval: {
        var interval = parseInt(self.params.pop());
        if(interval < 1) {
          self.puts(responses.verify_interval);
          self.jas_set(self.ra);
        }
        self.run();
        break;
      }
      case actions.ask_param: {
        self.params.push(in_queue[self.mid].shift());
        self.run();
        break;
      }
      default:
        throw "UNKNOWN_ENTRY";
        break;
    }
  } catch(err) {
    console.log(err)
    self.params = [];
    self.jas_set(actions.welcome);
    self.run();
  }
};
