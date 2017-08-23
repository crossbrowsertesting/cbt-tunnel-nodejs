var _ = require('lodash'),
	util = require('util'),
	cbtSocket = (require('./cbt_tunnels')),
	argv = require('yargs').env('CBT_TUNNELS').argv,
	fs = require('fs'),
	gfx = require('./gfx.js'),
	api = require('./api'),
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
	// console.log('in parseArgs');
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
		cmd: !!args.cmd,
		ready: !!args.ready,
		secret: args.secret
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
	// console.log('in cmdParse');
	cbtUrls = getCbtUrls(argv.test);

	var tType = argv.tType;
	if(!!tType){
		api.getAccountInfo(function(err, accountInfo){
			if (err || !accountInfo){
				warn('Authentication error! Please check your credentials and try again.');
				cb(err)
			}
			if(!err && accountInfo){
				// console.log('Got user account info!');
				params = parseArgs(argv, accountInfo);
				// console.log('got params: ' + util.inspect(params));
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
	api.getConManager( (err, getConManResult) => {
		if ( err ){ return cb(err) };
		if ( getConManResult.localConnectionManagerEnabled && !getConManResult.localConnectionManagerRunning ){
				err = new Error( 'Connection Manager is required for this account to start a tunnel, but it is not running. '
					+ 'Please contact your primary account holder or support@crossbrowsertesting.com' );
				warn(err)
				return cb(err);
		} else if ( getConManResult.localConnectionManagerEnabled && getConManResult.localConnectionManagerRunning && !params.secret){
			// this account has a connection manager running 
			// and was not started by the connection manager (no secret provided)
			// so ask the api to start a tunnel
			return self.api.startConManagerTunnel(params, cb);
		} else {
			console.log('about to post a tunnel with the secret: ' + params.secret);
			api.postTunnel(params.tType, params.tunnelName, params.secret, function(err, postResult){
				if(!err && postResult){
					// console.log('Posted!');
					// console.log(postResult.remote_server);
					var opts = {
						tcpPort: postResult.remote_port,
						cbtServer: postResult.remote_server,
						tp: postResult.tunnel_authkey,
						tid: postResult.tunnel_id,
						tu: postResult.tunnel_user
					}
					_.merge(params,opts);
					// console.log("ABOUT TO MAKE A SOCKET. PARAMS: " + util.inspect(params));
					cbts = new cbtSocket(api, params);
					cbts.start(function(err,socket){
						if(!err && socket){
							api.putTunnel(postResult.tunnel_id, params.tType, postResult.local, params.proxyIp, params.proxyPort, function(err,putResult){
								if(!err && putResult){
									// console.log('PUT request successful!');
									// console.log('Completely connected!');
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
	})
}

var validateArgs = function(cmdArgs){
	newArgs = JSON.parse(JSON.stringify(cmdArgs));
	var u = _.union(_.keys(cmdArgs),validParameters);
	var v = _.isEqual(u.sort(),validParameters.sort());
	if(!v){
		return new Error("I can't make sense of some of the flags you've provided, like: \n    "+_.difference(u.sort(),validParameters.sort())+"\n")
	}
	if(newArgs.httpProxy){
		process.env.http_proxy = newArgs.httpProxy;
		process.env.HTTP_PROXY = newArgs.httpProxy;
	}
	if(newArgs.httpsProxy){
		process.env.https_proxy = newArgs.httpsProxy;
		process.env.HTTPS_PROXY = newArgs.httpsProxy;
	}
	if(!newArgs.tunnelname){
		newArgs.tunnelName = null;
	}
	if(newArgs.dir){
		if(!newArgs.proxyIp && !newArgs.proxyPort){
			newArgs.tType = 'webserver';
		}else{
			return new Error("Arguments for both hosting local files and acting as a proxy server are provided; only one tunnel type may be specified.");
		}
	} else if(!!newArgs.proxyIp && !!newArgs.proxyPort ){
		if(!newArgs.dir && !newArgs.port){
			newArgs.tType = 'tunnel';
		}else{
			return new Error("Arguments for both hosting local files and acting as a proxy server are provided; only one tunnel type may be specified.");
		}
	}else if(!!newArgs.proxyIp || !!newArgs.proxyPort || !!newArgs.proxyUser || !!newArgs.proxyPass){
		return new Error("Starting a proxy server tunnel requires both a proxyIp and a proxyPort");
	}else{
		newArgs.tType = 'simpleproxy';
	}
	if(!newArgs.username){
		return new Error('You must specify a username.\n');
	}else if(!newArgs.authkey){
		return new Error('You must specifiy an authkey.\n');
	}
	return newArgs;
}

module.exports = {
	start: function(cmdArgs,cb){
		params = validateArgs(cmdArgs)
		if (params instanceof Error){
			return cb(params);
		}

		_.merge(argv, params);
		var cbtApi = api(params.username, params.authkey, params.test);
		cmdParse(cbtApi, function(err){
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

