var token = "";

var Line = function(token) {
  this.token = token;
}

Line.prototype.send = function(mid, msg) {
  var data = {
    to: [ mid ],
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
      'X-LINE-ChannelToken': this.token
    },
    json: data
  }, function(err, response, body) {
    if(err) {
      console.log(Date(), err, data);
    }
    console.log(Date(), body.messageId, body.timestamp);
  });
}

module.exports = Line;
