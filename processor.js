var config = require('./inc/config');
var actions = require('./inc/actions');
var responses = require('./inc/responses');
var request = require('request');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var Bus = require('./inc/bus');
var sequelize = new Sequelize(config.db.url);
var bus = new Bus(sequelize);

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
  this.items = 0;
  this.params = [];
  this.ra = 0;
  this.jas = new Array();
  this.jas_push(actions.welcome);
  console.log(Date(), "create", mid);
}

function to_time(minutes) {
  minutes %= 1440;
  return parseInt(minutes/60) + ":" + (parseInt(minutes % 60) < 10 ? "0" : "") + parseInt(minutes % 60);
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
  var self = this;
  sequelize.query(
    'SELECT `route`.`name` as `route_name`, `stop`.`back` as `back`, `stop`.`name` as `stop_name`, `subscription`.`start` as `start`, `subscription`.`end` as `end`, `subscription`.`interval` as `interval` FROM `subscription`, `stop`, `route` WHERE `subscription`.`mid` = :mid AND `stop`.`id` = `subscription`.`stop_id` AND `stop`.`route_id` = `route`.`id`', {
      replacements: {
        mid: this.mid
      },
      type: sequelize.QueryTypes.SELECT
    }
  ).then(function(rows) {
    self.items = rows.length;
    self.puts(["以下是你的訂閱紀錄：", rows.map(function(element, index, array) {
      return [
        "#" + index,
        "公車路號：" + element.route_name + "(" + (element.back == 0 ? "去" : "返") + ")",
        "到達站名：" + element.stop_name,
        "通知時間：" + to_time(element.start) + '-' + to_time(element.end),
        "通知間隔：每 " + element.interval + " 分鐘",
      ].join("\n");
    }).join("\n")].join("\n"));
  });
  this.params = [];
};

Member.prototype.item_count = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    sequelize.query(
      'SELECT count(*) as count FROM `subscription` WHERE `mid` = :mid GROUP BY `mid`', {
        replacements: {
          mid: self.mid
        },
        type: sequelize.QueryTypes.SELECT
      }
    ).then(function(results) {
      self.items = results[0]['count'];
      resolve(self.items);
    })
  })
}

Member.prototype.add = function() {
  // add subscription to db
  var self = this;
  console.log("params", self.params);
  sequelize.query(
    'INSERT INTO `subscription` (`mid`, `stop_id`, `start`, `end`, `interval`) VALUES(:mid, :stop_id, :start, :end, :interval)', {
      replacements: {
        mid: self.mid,
        stop_id: self.params[2],
        start: self.params[3][0],
        end: self.params[3][1],
        interval: self.params[4]
      },
      type: sequelize.QueryTypes.INSERT
    }
  ).then(function() {
    self.puts(responses.succeed_add);
  })
  self.params = [];
};

Member.prototype.edit = function() {
  console.log("params", this.params);
  this.params = [];
};

Member.prototype.delete = function() {
  var self = this;
  console.log("params", self.params);
  sequelize.query(
    'DELETE FROM `subscription` WHERE `id` IN (SELECT `t`.`id` FROM (SELECT `id` FROM `subscription` WHERE `mid` = :mid LIMIT ' + parseInt(self.params[0]) + ',1) as t)', {
      replacements: {
        mid: self.mid
      },
      type: sequelize.QueryTypes.DELETE
    }
  ).then(function() {
    self.puts(responses.suceed_delete);
  })
  this.params = [];
};

Member.prototype.stop_list = function() {
  var self = this;
  bus.list.stop(this.params[this.params.length - 1], this.params[this.params.length - 2]).then(function(list) {
    var result = list.map(function(element, index, array) {
      return index + ": " + element.name;
    });
    self.puts([result.join("\n"), responses.ask_stop].join("\n\n"));
  });
}

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
        self.gets();
        self.puts(responses.main_menu);
        self.beq(actions.verify_welcome, actions.welcome_navigate, actions.welcome);
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
        self.stop_list();
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
        break;
      }
      case actions.query: {
        self.query();
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
        var offset = self.params.pop();
        var back = self.params.pop();
        var route_id = self.params[self.params.length - 1];
        bus.search.stop(offset, back, route_id).then(function(rows) {
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
          self.params.push(time.map(function(str) {
            var val = parseInt(str);
            return parseInt(val / 100) * 60 + (val % 100);
          }));
        }
        self.run();
        break;
      }
      case actions.verify_interval: {
        var interval = parseInt(self.params.pop());
        if(interval < 1) {
          self.puts(responses.verify_interval);
          self.jas_set(self.ra);
        } else {
          self.params.push(interval);
        }
        self.run();
        break;
      }
      case actions.verify_item: {
        var item = parseInt(self.params.pop());
        if(item < 0 || item >= self.items) {
          self.puts(response.verify_item);
          self.jas_set(self.ra);
        } else {
          self.params.push(item);
        }
        self.run();
        break;
      }
      case actions.verify_welcome: {
        var selection = parseInt(self.params.pop());
        if(selection >= 1 && selection <= 3) {
          self.params.push(selection);
        } else {
          self.jas_set(self.ra);
        }
        self.run();
        break;
      }
      case actions.ask_param: {
        var input = self.gets();
        if(['x', 'X', '取消'].indexOf(input) !== -1) {
          throw "USER_ABORT";
        } else {
          self.params.push(input);
          self.run();
        }
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
