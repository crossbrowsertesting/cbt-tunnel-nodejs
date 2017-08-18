'use-strict';
var request = require('request');
var util = require('util');

/* 
 * example module use:
 *
 * get account info from prod:
 * >>> api = require('./api')(username, authkey)
 * >>> api.getAccountInfo( (err, resp, body) => console.log(body) )
 *
 * post `simpletunnel` named `bob` to test:
 * >>> api = require('./api')(username, authkey, 'test')
 * >>> api.postTunnel( 'simpletunnel', 'bob', (err, resp, body) => console.log(body) )
 *
 */

var encodeAuth = function(username, authkey){
	return (new Buffer(username+':'+authkey)).toString('base64');
}

var makeApiCall = function(server, method, path, qs, username, authkey, callback){
	console.log(`about to make a ${method} request to ${server} at ${path} for ${username}:${authkey}`)
	var options = {
		url: 'https://' + server + '/api/v3/' + path,
		method: method,
		headers: {
			authorization: 'authorized '+ encodeAuth(username, authkey)
		}
	}
	if (!!qs){
		options.qs = qs;
	}
	console.log("options: " + util.inspect(options));
	request(options, (err, resp, body) => {
		console.log(`got resp for getAccountInfo`);
		// parse resp body, or set it to parse error string
		// note: invalid json in response body WILL NOT cause an error to be thrown
		try {
			body = JSON.parse(body);
		} catch (ex) {
			console.log("error parsing cbt_node response")
			body = `< error parsing response: ${ex} raw response => ${body} >`;
		} 

		// non 200 statusCodes should return an error
		if ( resp.statusCode !== 200 ) {
			err = new Error(`statusCode from cbt_node !== 200. Got ${JSON.stringify(body)} `)
		};
		if (err) {
			callback(err) 
		} else {
			// all good! return parsed body
			callback(null, body);
		}
	})
}

module.exports = function(username, authkey, isTest){
	if (!!isTest){
		var server = 'testapp.crossbrowsertesting.com'
	} else {
		var server = 'crossbrowsertesting.com'
	}

//////////////////////////////////////////////////
////  This is the real meat of the module.    ////
////  These are the exported functions.       ////
//////////////////////////////////////////////////
	return {
		getAccountInfo: function(callback){
			makeApiCall(server, 'GET', 'account', null, username, authkey, (err, body) => {
				console.log(`got resp for getAccountInfo`);
				return callback(err, body);
			})
		},
		postTunnel: function(tunnelType, tunnelName, callback){
			makeApiCall(server, 'POST', 'tunnels', {
				tunnel_source: 'nodews',
				tunnel_type: tunnelType,
				tunnel_name: tunnelName
			} , username, authkey, (err, body) => {
				console.log(JSON.stringify(body));
				return callback(err, body);
			})
		},
		putTunnel: function(tunnelId, tunnelType, directory, port, callback){
			console.log(`got resp for putTunnel`);
			makeApiCall(server, 'PUT', 'tunnels/' + tunnelId, {
				local_directory: directory || '',
				local_ip:'localhost',
				local_port: port || '',
				message:'SUCCESS',
				state:'1',
				tunnel_source: 'nodews',
				tunnel_type: tunnelType
			}, username, authkey, (err, body) => {
				console.log(`got resp for putTunnel`);
				return callback(err, body);
			});
		}
	}
}


