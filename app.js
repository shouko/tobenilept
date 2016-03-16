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
  add_proceed: 91,
  query: 2,
  modify: 3,
  modify_navigate: 30,
  modify_station: 31,
  modify_time: 32,
  modify_interval: 33,
  modify_proceed: 93,
  delete: 4,
  delete_proceed: 94
};
var modify_menu = {
  1: 31,
  2: 32,
  3: 33
};
var response_text = {
  ask_route: "請輸入欲訂閱之公車路號（如：650）",
  ask_station: "請輸入目標公車站名：",
  ask_time: "請輸入通知時間區間：\n（如：0810-0840）",
  ask_interval: "請輸入通知時間間隔：\n（如：5）",
  ask_delete: "請輸入欲刪除之項目編號：",
  succeed_add: "您的訂閱已完成！",
  succeed_modify: "您的訂閱已完成更新！"
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
      if(messages.length > 1) {
        fetched = messages[messages.length - 1].id;
        sequelize.query(
          'UPDATE `message` SET `done` = 1 WHERE `id` <= :id', {
            replacements: {
              id: fetched
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      }
      messages.forEach(function(element, index, array) {
        if(typeof(in_queue[element.mid]) == "undefined" || typeof(members[element.mid]) == "undefined") {
          in_queue[element.mid] = new Array();
          members[element.mid] = new Member(element.mid);
        }
        in_queue[element.mid].push(element.payload);
        members[element.mid].run();
      });
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
  return element + ":請輸入 " + option_num;
}).join("\n");

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
    console.log(Date(), response);
  });
};

Member.prototype.query = function() {
  // fetch subscription record
  this.puts("以下是你的訂閱紀錄");
}

Member.prototype.add = function() {
  // add subscription to db
  this.puts('您的訂閱已完成');
}

Member.prototype.run = function() {
  try {
    switch(this.next) {
      case actions.welcome: {
        in_queue[this.mid].shift();
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
        this.puts(response_text.ask_route);
        this.next_ra = actions.add_station
        this.next = actions.ask_param;
        break;
      }
      case actions.add_station: {
        this.puts(response_text.ask_station);
        this.next_ra = actions.add_time
        this.next = actions.ask_param;
        break;
      }
      case actions.add_time: {
        this.puts(response_text.ask_time);
        this.next_ra = actions.add_interval
        this.next = actions.ask_param;
        break;
      }
      case actions.add_interval: {
        this.puts(response_text.ask_interval);
        this.next_ra = actions.add_interval
        this.next = actions.ask_param;
        break;
      }
      case actions.add_proceed: {
        // proceed add action with params
        this.puts(response_text.succeed_add);
        break;
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
        this.puts(response_text.ask_station)
        this.next_ra = actions.modify_proceed;
        this.next = actions.ask_param;
        break;
      }
      case actions.modify_time: {
        this.puts(response_text.ask_time)
        this.next_ra = actions.modify_proceed;
        this.next = actions.ask_param;
        break;
      }
      case actions.modify_interval: {
        this.puts(response_text.ask_interval)
        this.next_ra = actions.modify_proceed;
        this.next = actions.ask_param;
        break;
      }
      case actions.modify_proceed: {
        // do dome modify job with params[2]
        this.puts(response_text.succeed_modify);
        break;
      }
      case actions.delete: {
        this.query();
        this.puts(response_text.ask_delete);
        this.next_ra = actions.delete_proceed;
        this.next = actions.ask_param;
        break;
      }
      case actions.delete_proceed: {
        // do dome delete job with params[1]
        this.puts(response_text.succeed_modify);
        break;
      }
      case actions.ask_param: {
        params.push(in_queue[this.mid].shift());
        this.next = this.next_ra;
        this.run();
        break;
      }
      default:
        throw 1;
        break;
    }
  } catch(err) {
    this.next = actions.welcome;
    this.run();
  }
};
