var main_menu = "歡迎使用臺北市政府 LINE 訂閱公車到站資訊服務\n";
main_menu += ["訂閱公車資訊", "查詢訂閱紀錄", "更改訂閱紀錄", "刪除訂閱紀錄"].map(function(element, index, array) {
  var option_num = index + 1;
  return element + ":請輸入 " + option_num;
}).join("\n");

module.exports = {
  main_menu: main_menu,
  ask_route: "請輸入欲訂閱之公車路號（如：650）",
  ask_station: "請輸入目標公車站名：",
  ask_time: "請輸入通知時間區間：\n（如：0810-0840）",
  ask_interval: "請輸入通知時間間隔：\n（如：5）",
  ask_delete: "請輸入欲刪除之項目編號：",
  ask_modify: "請輸入欲更改內容之項目編號：\n到站名稱：請輸入 1\n通知訊息時間：請輸入 2\n通知訊息間隔：請輸入 3",
  succeed_add: "您的訂閱已完成！",
  succeed_modify: "您的訂閱已完成更新！"
};
