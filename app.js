var config = require('./config');
var request = require('request');
var Sequelize = require('sequelize');
var sequelize = new Sequelize(config.db.url);
var actions = {
  add: 1,
  query: 2,
  modify: 3,
  delete: 4
};

var active_users = new Array();

var in_queue = new Array();
var fetched = 0;
var next_fetch = 200;
var empty_rounds = 0;

function fetch() {
  // fetch new message from db
  // SELECT * FROM `message` WHERE `id` > fetched
  var results = [];
  results.forEach(function(element, index, array) {
    if(typeof(queue[element.mid]) == "undefined") {
      in_queue[element.mid] = new Array();
      active_users.push(new Member(element.mid));
    }
    in_queue[element.mid].push(element.payload);
  });
  return results.length;
}

function schedule_fetch(wait) {
  setTimeout(function() {
    if(fetch() == 0) {
      empty_rounds++;
      next_fetch += 200 * empty_rounds;
    }
    schedule_fetch(next_fetch);
  }, wait);
}

var msg = {
  main_menu: "歡迎使用臺北市政府 LINE 訂閱公車到站資訊服務\n"
}

msg.main_menu += ["訂閱公車資訊", "查詢訂閱紀錄", "更改訂閱紀錄", "刪除訂閱紀錄"].map(function(element, index, array) {
  var option_num = index + 1;
  return option_num + ". " + element + ":請輸入 " + option_num;
}).join("\n");

function Member(mid) {
  this.mid = mid;
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

Member.prototype.run = function() {
  try {
    var action;
    while(1) {
      puts(msg.main_menu);
      action = gets();
      if([1, 2, 3, 4].indexOf(action) == -1) {
        break;
      }
    }
    switch(action) {
      case actions.add: {
      }
      case actions.query: {
      }
      case actions.modify: {
      }
      case actions.delete: {
      }
    }
  } catch(UserInputTimeoutException) {

  }
};
