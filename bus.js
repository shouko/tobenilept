var request = require('request');
var Promise = require('bluebird');
var shellescape = require('shell-escape');
var child_process = require('child_process');

function fetch_json_gz(url) {
	return new Promise(function(resolve, reject) {
		child_process.exec(
			[shellescape(['curl', '-L', url]), '|', 'gunzip -c'].join(' '),
			{
				maxBuffer: 10 * 1024 * 1024
			},
			function(err, stdout, stderr) {
				resolve(JSON.parse(stdout));
			}
		);
	})
}

var data_sets = {
	stop: 'http://data.taipei/bus/Stop',
	route: 'http://data.taipei/bus/ROUTE'
};

var Bus = function(sequelize) {
	this.sequelize = sequelize;
}

Bus.prototype.fetch = {
	route: function() {
		return new Promise(function(resolve, reject) {
			fetch_json_gz(data_sets.route).then(function(data) {
				new Promise.all(data.BusInfo.map(function(row) {
					return this.sequelize.query(
						'INSERT INTO `route` (`id`, `name`, `departure`, `destination`) VALUES(:id, :name, :departure, :destination) ON DUPLICATE KEY UPDATE `name` = :name, `departure` = :departure, `destination` = :destination', {
							replacements: {
								id: row.Id,
								name: row.nameZh,
								departure: row.departureZh,
								destination: row.destinationZh
							},
							type: sequelize.QueryTypes.INSERT
						}
					);
				})).then(resolve);
			});
		});
	},
	stop: function() {
		return new Promise(function(resolve, reject) {
			fetch_json_gz(data_sets.stop).then(function(data) {
				new Promise.all(data.BusInfo.map(function(row) {
					return this.sequelize.query(
						'INSERT INTO `stop` (`id`, `name`, `route_id`, `back`) VALUES(:id, :name, :route_id, :back) ON DUPLICATE KEY UPDATE `name` = :name, `route_id` = :route_id, `back` = :back', {
							replacements: {
								id: row.Id,
								name: row.nameZh,
								route_id: row.routeId,
								back: row.goBack
							},
							type: sequelize.QueryTypes.INSERT
						}
					);
				})).then(resolve);
			});
		});
	}
};

module.exports = Bus;
