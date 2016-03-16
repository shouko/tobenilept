var config = require('./config');
var request = require('request');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var sequelize = new Sequelize(config.db.url);
var actions = {
  welcome: 0,
  welcome_navigate: 90,
  add_route: 1,
  add_station: 11,
  add_time: 12,
  add_interval: 13,
  add_proceed: 91
  query: 2,
  modify: 3,
  modify_navigate: 30,
  modify_station: 31,
  modify_time: 32,
  modify_interval: 33,
  delete: 4
};
var modify_menu = {
  1: 31,
  2: 32,
  3: 33
};
var ask_text = {
  route: "請輸入欲訂閱之公車路號（如：650）",
  station: "請輸入目標公車站名：",
  time: "請輸入通知時間區間：\n（如：0810-0840）",
  interval: "請輸入通知時間間隔：\n（如：5）",
  delete: "請輸入欲刪除之項目編號："
}

var active_users = new Array();

var in_queue = new Array();
var fetched = 0;
var next_fetch = 200;
var empty_rounds = 0;

function fetch() {
  return new Promise(function(resolve, reject) {
    sequelize.query(
      'SELECT * FROM `message` WHERE `id` > :id', {
        replacements: {
          id: fetched
        },
        type: sequelize.QueryTypes.SELECT
      }
    ).then(function(messages) {
      messages.forEach(function(element, index, array) {
        if(typeof(queue[element.mid]) == "undefined") {
          in_queue[element.mid] = new Array();
          active_users.push(new Member(element.mid));
        }
        in_queue[element.mid].push(element.payload);
      });
      fetched = messages[messages.length - 1].id;
      resolve(messages.length);
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

var msg = {
  main_menu: "歡迎使用臺北市政府 LINE 訂閱公車到站資訊服務\n"
}

msg.main_menu += ["訂閱公車資訊", "查詢訂閱紀錄", "更改訂閱紀錄", "刪除訂閱紀錄"].map(function(element, index, array) {
  var option_num = index + 1;
  return option_num + ". " + element + ":請輸入 " + option_num;
}).join("\n");

function Member(mid) {
  this.mid = mid;
  this.params = [];
  this.next = actions.welcome;
}

Member.prototype.gets = function() {
  return in_queue[this.mid].shift();
};

Member.prototype.puts = function(msg) {
  var data = {
    to: [ this.mid ],
    toChannel: 1383378250,
    eventType: 138311608800106203,
    content: {
      contentType: 1,
      toType: 1,
      text: msg
    }
  };
  request({
    method: 'POST',
    url: 'https://api.line.me/',
    headers: {
      'X-LINE-ChannelToken': config.line.ChannelToken
    },
    json: data
  }, function(err, response, body) {
    if(err) {
      console.log(Date(), err, data);
    }
  });
};

Member.prototype.query = function() {
  // fetch subscription record
  this.puts();
}

Member.prototype.add = function() {
  // add subscription to db
  this.puts('您的訂閱已完成');
}

Member.prototype.run = function() {
  try {
    switch(this.next) {
      case actions.welcome: {
        this.puts(msg.main_menu);
        this.next_ra = actions.welcome_navigate;
        this.next = actions.ask_param;
        break;
      }
      case actions.welcome_navigate: {
        this.next = params[0];
        break;
      }
      case actions.add_route: {
        this.puts(ask_text.route);
        this.next_ra = actions.add_station
        this.next = actions.ask_param;
        break;
      }
      case actions.add_station: {
        this.puts(ask_text.station);
        this.next_ra = actions.add_time
        this.next = actions.ask_param;
        break;
      }
      case actions.add_time: {
        this.puts(ask_text.time);
        this.next_ra = actions.add_interval
        this.next = actions.ask_param;
        break;
      }
      case actions.add_interval: {
        this.puts(ask_text.interval);
        this.next_ra = actions.add_interval
        this.next = actions.ask_param;
        break;
      }
      case actions.add_proceed: {
        // proceed add action with params
      }
      case actions.query: {
        this.query();
        break;
      }
      case actions.modify: {
        this.query();
        this.puts("請輸入欲更改內容之項目編號：\n到站名稱：請輸入 1\n通知訊息時間：請輸入 2\n通知訊息間隔：請輸入 3");
        this.next_ra = actions.modify_navigate
        this.next = actions.ask_param;
        break;
      }
      case actions.modify_navigate: {
        this.next = modify_menu[params[1]];
        this.run();
        break;
      }
      case actions.modify_station: {
        this.puts(ask_text.station)
        this.next_ra = actions.modify_proceed;
        this.next = actions.ask_param;
        break;
      }
      case actions.modify_time: {
        break;
      }
      case actions.modify_interval: {
        break;
      }
      case actions.modify_proceed: {
        break;
      }
      case actions.delete: {
        this.query();
        this.puts(ask_text.delete);
        this.gets();
        break;
      }
      case actions.ask_param: {
        params.push(in_queue[this.mid].shift());
        this.next = this.next_ra;
        this.run();
        break;
      }
    }
  } catch(Exception) {
    this.next = actions.welcome;
  }
};
