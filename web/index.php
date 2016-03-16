<?php
require 'config.php';
include 'constants.php';
function fail() {
	http_response_code(400);
	die();
}
if($_SERVER['REQUEST_METHOD'] !== "POST") {
	fail();
}
$body = file_get_contents('php://input');
$mac = base64_encode(hash_hmac("sha256", utf8_encode($body), utf8_encode(LINE_SECRET), true));
if($mac !== $_SERVER['HTTP_X_LINE_CHANNELSIGNATURE']) {
	fail();
}
$body = json_decode($body, 1);
if(empty($body['result'])) {
	fail();
}
foreach($body['result'] as $row) {
	if(
		$row['eventType'] == $line_const['eventType']['Message'] &&
		$row['content']['toType'] == $line_const['toType']['User'] &&
		$row['content']['contentType'] == $line_const['contentType']['Text']
	) {
		$row['content']['from'];
		$row['content']['createdTime'];
		$row['content']['text']
	}
}
file_put_contents("./log/".time().".txt", implode("\n\n", array(print_r($_SERVER, true), $body, $mac)));
echo "ok";
