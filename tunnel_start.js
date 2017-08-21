var _ = require('lodash'),
	util = require('util'),
	request = require('request'),
	cbtSocket = (require('./cbt_tunnels')),
	argv = require('yargs').env('CBT_TUNNELS').argv,
	fs = require('fs'),
	gfx = require('./gfx.js'),
	cbts = null,
	warn = gfx.warn,
	help = gfx.help,
	cbtUrls = {
		server: "crossbrowsertesting.com",
		node: "crossbrowsertesting.com"
	},
	tType,
	cmd = false,
	validParameters = ['quiet','proxyUser','proxyPass','httpsProxy','httpProxy','_','ready','username','authkey','$0','simpleproxy','tunnel','webserver','cmd','proxyIp','proxyPort','port','dir','verbose','kill','test','tunnelname'];


var getCbtUrls = function(isTest){
	if ( isTest ){
		return {server: "test.crossbrowsertesting.com", node: "testapp.crossbrowsertesting.com"}
	} else {
		return {server: "crossbrowsertesting.com", node: "crossbrowsertesting.com"}
	}
}

var parseArgs = function(args, accountInfo){
	console.log('in parseArgs');
	cbtUrls = getCbtUrls(args.test);

	var tType = args.tType;
	var params = {
		urls: cbtUrls,
		verbose: args.verbose,
		username: args.username,
		quiet: args.quiet,
		authkey: accountInfo.auth_key,
		tType:tType,
		userId: accountInfo.user_id,
		tunnelName: args.tunnelname,
		cmd: !!cmd,
		ready: !!args.ready
	}
	switch(tType){
		case 'simpleproxy':
			// no special parsing needed
			return params
			break;
		case 'tunnel':
			if(!!args.proxyIp && !!args.proxyPort && !(!!args.proxyUser != !!args.proxyPass)){
				params.proxyIp = args.proxyIp;
				params.proxyPort = args.proxyPort;
				params.bytecode = true;

				if(!!args.proxyPass && !!args.proxyUser){
					params.proxyPass = args.proxyPass;
					params.proxyUser = args.proxyUser;
				}
				return params;
			}else if( !args.proxyIp || !args.proxyIp ){
				return new Error('You must specify the proxy IP (--proxyIp) to create a tunnel.');
			}else if(!args.proxyUser || !args.proxyPass){
				return new Error('You must specify both a proxy user (--proxyUser) and a proxy password (--proxyPass) to use basic authentication with the proxy option.');
			}else{
				return new Error('You must specify the proxy port (--proxyPort) to create a tunnel.\n\n');
			}
			break;
		case 'webserver':
			if(!!args.dir){
				if(!args.port){
					var port = null;
				}
				params.directory = args.dir;
				params.port = args.port;
				return params;
			}else{
				return new Error('You must specifiy a directory (--dir) to create a webserver.\n\n');
			}
			break;
		default:
			return new Error('This should not happen.');
	}
}



var cmdParse = function(api, cb){
	console.log('in cmdParse');
	cbtUrls = getCbtUrls(argv.test);

	var tType = argv.tType;
	if(!!tType){
		api.getAccountInfo(function(err, accountInfo){
			if (err || !accountInfo){
				warn('Authentication error! Please check your credentials and try again.');
				cb(err)
			}
			if(!err && accountInfo){
				console.log('Got user account info!');
				params = parseArgs(argv, accountInfo);
				console.log('got params: ' + util.inspect(params));
				if (params instanceof Error){
					warn(params.message);
					help()
				} else {
					startTunnel(api, params, cb);
				}
			}
		});
	}
}

var startTunnel = function(api, params, cb){
	api.postTunnel(params.tType, params.tunnelName, function(err, postResult){
		if(!err && postResult){
			console.log('Posted!');
			console.log(postResult.remote_server);
			var opts = {
				tcpPort: postResult.remote_port,
				cbtServer: postResult.remote_server,
				tp: postResult.tunnel_authkey,
				tid: postResult.tunnel_id,
				tu: postResult.tunnel_user
			}
			_.merge(params,opts);
			console.log("ABOUT TO MAKE A SOCKET. PARAMS: " + util.inspect(params));
			cbts = new cbtSocket(api, params);
			cbts.start(function(err,socket){
				if(!err && socket){
					api.putTunnel(postResult.tunnel_id, params.tType, postResult.local, params.proxyIp, params.proxyPort, function(err,putResult){
						if(!err && putResult){
							console.log('PUT request successful!');
							console.log('Completely connected!');
							cb(null);

						}else{
							console.log(err);
							cb(err);
							cbts.endWrap();
						}
					});
				}else{
					cb(err);
					cbts.endWrap();
				}
			});
		}else{
			console.log(err);
			setTimeout(function(){
				cb(err);
				process.exit(1);
			},10000);
		}
	});
	if(argv.kill){
		setInterval(function(){
			fs.stat('./'+argv.kill,function(error,stat){
				if(error==null){
					fs.unlink('./'+argv.kill,function(err){
						if(err==null){
							cbts.endWrap();
						}else{
							console.log(err);
							setTimeout(function(){
								process.exit(1);
							},10000);
						}
					})
				}
			})
		},1000);
	}
}

module.exports = {
	start: function(params,cb){

		// parse arguments
		var api = require('./api')(argv.username, argv.authkey, argv.test);
		var u = _.union(_.keys(params),validParameters);
		var v = _.isEqual(u.sort(),validParameters.sort());
		if(!v){
			help();
			warn("I can't make sense of some of the flags you've provided, like: \n    "+_.difference(u.sort(),validParameters.sort())+"\n");
			process.exit(1);
		}
		if(params.cmd){
			cmd = true;
		}
		if(params.httpProxy){
			process.env.http_proxy = params.httpProxy;
			process.env.HTTP_PROXY = params.httpProxy;
		}
		if(params.httpsProxy){
			process.env.https_proxy = params.httpsProxy;
			process.env.HTTPS_PROXY = params.httpsProxy;
		}
		if(!params.tunnelname){
			params.tunnelName = null;
		}
		if(params.dir){
			if((_.isNull(params.proxyIp)||_.isUndefined(params.proxyIp))&&(_.isNull(params.proxyPort)||_.isUndefined(params.proxyPort))){
				argv.tType = 'webserver';
			}else{
				help();
				warn("Arguments for both hosting local files and acting as a proxy server are provided; only one tunnel type may be specified.");
				process.exit(1);
			}
		}else if(!_.isUndefined(params.proxyIp)&&!_.isNull(params.proxyIp)&&!_.isUndefined(params.proxyPort)&&!_.isNull(params.proxyPort)){
			if(!params.dir&&!params.port){
				argv.tType = 'tunnel';
			}else{
				help();
				warn("Arguments for both hosting local files and acting as a proxy server are provided; only one tunnel type may be specified.");
				process.exit(1);
			}
		}else if((!_.isUndefined(params.proxyIp)&&!_.isNull(params.proxyIp))||(!_.isUndefined(params.proxyPort)&&!_.isNull(params.proxyPort))||(!_.isUndefined(params.proxyUser))||(!_.isUndefined(params.proxyPass))){
			help();
			warn("Starting a proxy server tunnel requires both a proxyIp and a proxyPort");
			process.exit(1);
		}else{
			argv.tType = 'simpleproxy';
		}
		if((_.isUndefined(params.username)) || (_.isNull(params.username))){
			help();
			warn('You must specify a username.\n');
			process.exit(1);
		}else if((_.isUndefined(params.authkey)) || _.isNull(params.authkey)){
			help();
			warn('You must specifiy an authkey.\n');
			process.exit(1);
		}
		_.merge(argv,params);
		cmdParse(api, function(err){
			cb(err);
		});
	},
	stop: function(){
		if(!_.isNull(cbts)){
			cbts.endWrap();
		}else{
			warn('You must start the tunnel first by calling the function "start" with the relevant parameters.');
		}
	},
	status: function(){
		if(!_.isNull(cbts) && !_.isUndefined(cbts)){
			return true;
		}else{
			return false;
		}
	}
}

