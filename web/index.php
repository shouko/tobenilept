<?php
require 'config.php';
include 'constants.php';
function fail($text) {
	http_response_code(400);
	die($text);
}
if($_SERVER['REQUEST_METHOD'] !== "POST") {
	fail('invalid_method');
}
$body = file_get_contents('php://input');
$mac = base64_encode(hash_hmac("sha256", utf8_encode($body), utf8_encode(LINE_SECRET), true));
if($mac !== $_SERVER['HTTP_X_LINE_CHANNELSIGNATURE']) {
	fail('invalid_request');
}
$body = json_decode($body, 1);
if(empty($body['result'])) {
	fail('empty_body');
}
try {
	$db = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=UTF8', DB_USER, DB_PASS);
	$stmt_text = $db->prepare('INSERT INTO `message` (`msg_id`, `mid`, `payload`, `done`, `stime`) VALUES(:msg_id, :mid, :payload, 0, FROM_UNIXTIME(:stime)');
	foreach($body['result'] as $row) {
		if(
			$row['eventType'] == $line_const['eventType']['Message'] &&
			$row['content']['toType'] == $line_const['toType']['User'] &&
			$row['content']['contentType'] == $line_const['contentType']['Text']
		) {
			// receive text message
			$stmt_text->execute(array(
				':msg_id' => $row['content']['id'],
				':mid' => $row['content']['from'],
				':payload' => $row['content']['text'],
				':stime' => $row['content']['createdTime']
			));
		} else if(
			$row['eventType'] == $line_const['eventType']['Operation'] &&
			$row['content']['opType'] == $line_const['operationType']['Friend']
		) {
			// add as friend
		}
	}
	echo "ok";
} catch(PDOException $e) {
	http_response_code(500);
	die();
}
