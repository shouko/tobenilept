var main_menu = "歡迎使用臺北市政府 LINE 訂閱公車到站資訊服務\n";
main_menu += ["訂閱公車資訊", "查詢訂閱紀錄", "刪除訂閱紀錄"].map(function(element, index, array) {
  var option_num = index + 1;
  return element + ":請輸入 " + option_num;
}).join("\n");

module.exports = {
  main_menu: main_menu,
  ask_route: "請輸入欲訂閱之公車路號（如：650）",
  ask_back: "請輸入是否為返程：\n去程：請輸入 0\n返程：請輸入 1",
  ask_stop: "請輸入目標車站編號：",
  ask_time: "請輸入通知時間區間：\n（如：0810-0840）",
  ask_interval: "請輸入通知時間間隔：\n（如：5）",
  ask_delete: "請輸入欲刪除之項目編號：",
  succeed_add: "您的訂閱已完成！",
  succeed_delete: "您的訂閱已完成刪除！",
  verify_time: "時間錯誤，請輸入正確格式的時間",
  verify_route: "輸入錯誤，請重新輸入正確的公車路線",
  verify_back: "輸入錯誤，請重新輸入",
  verify_stop: "公車站編號錯誤，請重新輸入",
  verify_interval: "輸入錯誤，最小間隔為 1 分鐘",
  verify_item: "輸入編號錯誤，請重新輸入正確的編號"
};
