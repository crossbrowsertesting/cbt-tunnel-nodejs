var _ = require('lodash'),
    utils = require('./utils.js'),
    cbtSocket = (require('./cbt_tunnels')),
    argv = require('yargs').env('CBT_TUNNELS').argv,
    fs = require('fs'),
    gfx = require('./gfx.js'),
    Api = require('./api'),
    cbts = null,
    warn = gfx.warn,
    help = gfx.help,
    validParameters = ['quiet', 'proxyUser', 'proxyPass', 'httpsProxy', 'httpProxy', '_', 'ready',
        'username', 'authkey', '$0', 'simpleproxy', 'tunnel', 'webserver', 'cmd', 'proxyIp',
        'proxyPort', 'port', 'dir', 'verbose', 'kill', 'test', 'tunnelname', 'secret', 'pac', 
        'rejectUnauthorized', 'bypass'];

var validateArgs = function(cmdArgs){
    // make sure that user has provided username/authkey and no extraneous options
    if(!cmdArgs.username){
        throw new Error('You must specify a username.\n');
    }else if(!cmdArgs.authkey){
        throw new Error('You must specifiy an authkey.\n');
    }
    var u = _.union(_.keys(cmdArgs),validParameters);
    var v = _.isEqual(u.sort(),validParameters.sort());
    if(!v){
        throw new Error("I can't make sense of some of the flags you've provided, like: \n    " 
            + _.difference( u.sort(), validParameters.sort() ) + "\n")
    }
    return cmdArgs;
}

var determineTunnelType = function(cmdArgs){
    // throws errors if args conflict and no valid tunnelType can be determined
    var tunnelType;
    if(cmdArgs.dir){
        if( !cmdArgs.proxyIp && !cmdArgs.proxyPort ){
            tunnelType = 'webserver';
        }else{
            throw new Error("Arguments for both hosting local files and acting as a proxy server are "
            + "provided; only one tunnel type may be specified.");
        }
    } else if( !!cmdArgs.proxyIp || !!cmdArgs.proxyPort ){
        // if user specifies proxyIp or proxyPort, we'll run our 'tunnel' checks
        if( cmdArgs.dir && cmdArgs.port ){
            // make sure user didn't also specify webserver options
            throw new Error("Arguments for both hosting local files and acting as a proxy server are "
            + "provided; only one tunnel type may be specified.");
        } else if( !cmdArgs.proxyIp || !cmdArgs.proxyPort ){
            // make sure the user specified proxyIp AND proxyPort
            throw new Error("You must specify the proxy IP (--proxyIp) AND proxy port (--proxyPort) "
            + "to create a tunnel.");
        } else if( !!cmdArgs.proxyUser != !!cmdArgs.proxyPass ){
            // make sure user specifies both or neither of proxyUser and proxyPass
            throw new Error("You must specify both a proxy user (--proxyUser) and a proxy password "
            + "(--proxyPass) to use basic authentication with the proxy option.");
        } else {
            tunnelType = 'tunnel';
        }
    } else {
        tunnelType = 'simpleproxy';
    }
    return tunnelType;
}

var pacInit = function(cbtUrls,cmdArgs,cb){
    if(cmdArgs.pac){
        console.log(cmdArgs.pac);
        utils.getPac(cmdArgs.pac,function(err,pac){
            if(err){
                cb(err);    
            }
            utils.determineHost({host:'https://'+cbtUrls.node,port:443},pac,function(err,hostInfo){
                if(hostInfo.host+':'+hostInfo.port!=='https://'+cbtUrls.node+':'+443){
                    utils.setProxies(true,'http://'+hostInfo.host+':'+hostInfo.port);
                }
                utils.determineHost({host:'http://'+cbtUrls.node,port:80},pac,function(err,hostInfo){
                    if(hostInfo.host+':'+hostInfo.port!=='http://'+cbtUrls.node+':'+80){
                        utils.setProxies(false,'http://'+hostInfo.host+':'+hostInfo.port);
                    }
                    cb(null,pac);

                });
            });
        });
    }else{
        cb(null,null);
    }
}

var startConManTunnelViaApi = function(api, params, cb){
    // sends err to callback if LCM is not running
    // console.log("going to start a conman tunnel via api");
    api.getConManager( (err, getConManResult) => {
        // console.log("getconmanresult: " + util.inspect(getConManResult));
        if ( err ){ return cb(err) };
        if ( getConManResult.localConnectionManagerEnabled && !getConManResult.localConnectionManagerRunning ){
            // LCM is enabled but NOT running
            err = new Error( 'Connection Manager is required for this account to start a tunnel, but it is not running. '
                + 'Please contact your primary account holder or support@crossbrowsertesting.com' );
            warn(err);
            return cb(err);
        } else if ( getConManResult.localConnectionManagerEnabled && getConManResult.localConnectionManagerRunning ){
            // this account has a connection manager running 
            // so ask the api to start a tunnel
            return api.startConManagerTunnel(params, cb);
        }
    });
}

var startTunnel = function(api, params, cb){
    api.postTunnel(params.tType, params.tunnelName, params.bypass, params.secret, function(err, postResult){
        if( err || !postResult){
            err = err ||  new Error("Post to CBT failed. Returned falsy value: " + postResult);
            return cb(err);
        }
        var opts = {
            tcpPort: postResult.remote_port,
            cbtServer: postResult.remote_server,
            tp: postResult.tunnel_authkey,
            tid: postResult.tunnel_id,
            tu: postResult.tunnel_user
        }
        _.merge(params,opts);
        cbts = new cbtSocket(api, params);
        cbts.start(function(err,socket){
            if(!err && socket){
                api.putTunnel(postResult.tunnel_id, params.tType, postResult.local, params.proxyIp, params.proxyPort, function(err,putResult){
                    if(!err && putResult){
                        console.log('Completely connected!');
                        cb(null);

                    }else{
                        // console.log(err);
                        cb(err);
                        cbts.endWrap();
                    }
                });
            }else{
                cb(err);
                cbts.endWrap();
            }
        });
    });
    // poll for kill file and exit
    if(params.kill){
        setInterval(function(){
            fs.stat('./'+params.kill,function(error,stat){
                if(error==null){
                    fs.unlink('./'+params.kill,function(err){
                        if(err==null){
                            cbts.endWrap();
                        }else{
                            // console.log(err);
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
    start: function(cmdArgs, cb){
        try {
            //remove all null or undefined args
            cmdArgs = _(cmdArgs).omit(_.isUndefined).omit(_.isNull).value()
            // throws error if there's an invalid arg
            validateArgs(cmdArgs);

            // option to not reject unauthorized
            if(!cmdArgs.rejectUnauthorized||cmdArgs.rejectUnauthorized==='false'){
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            }
            // throws error if args conflict or no valid tunnelType can be determined
            cmdArgs.tType = determineTunnelType(cmdArgs); 

            if( cmdArgs.tType == 'tunnel' ){
                cmdArgs.bytecode = true;
            }
            // default tunnelName to null
            if(!cmdArgs.tunnelname){
                cmdArgs.tunnelName = null;
            }
            // default port to null
            if(!cmdArgs.port){
                cmdArgs.port = null;
            }

            // not sure why we do this
            _.merge(argv, cmdArgs);

            if ( cmdArgs.test ){
                var cbtUrls = {server: "test.crossbrowsertesting.com", node: "testapp.crossbrowsertesting.com"}
            } else {
                var cbtUrls = {server: "crossbrowsertesting.com", node: "crossbrowsertesting.com"}
            }

            pacInit(cbtUrls,cmdArgs,function(err,pac){
                if(err){
                    warn("Failed to initialize PAC");
                    return cb(err);
                }
                cmdArgs.pac = pac;
                if(cmdArgs.httpProxy){
                    utils.setProxies(false,cmdArgs.httpProxy);
                }
                if(cmdArgs.httpsProxy){
                    utils.setProxies(true,cmdArgs.httpsProxy);
                }
                var bypass = null;
                if(!_.isUndefined(cmdArgs.bypass)){
                    bypass = ((cmdArgs.bypass.toLowerCase()) === 'false' || (parseInt(cmdArgs.bypass) === 0)) ? false : true;
                }
                // if ( cmdArgs.test === 'local' ){
                //  cbtUrls = {server: "localhost:3000", node: "localhost:3000"};
                // }

                var params = {
                    urls: cbtUrls,
                    verbose: cmdArgs.verbose,
                    username: cmdArgs.username,
                    authkey: cmdArgs.authkey,
                    proxyIp: cmdArgs.proxyIp,
                    proxyPort: cmdArgs.proxyPort,
                    quiet: cmdArgs.quiet,
                    tType: cmdArgs.tType,
                    tunnelName: cmdArgs.tunnelname,
                    cmd: !!cmdArgs.cmd,
                    ready: !!cmdArgs.ready,
                    secret: cmdArgs.secret,
                    pac: cmdArgs.pac,
                    bypass: bypass
                }

                // This api call just to make sure the credentials are valid.
                // We might could remove this and rely on the connection 
                // manager check to validate credentials.
                var api = Api(cmdArgs.username, cmdArgs.authkey, cmdArgs.test);
                // debugger;
                api.getAccountInfo(function(err, accountInfo){
                    // console.log("account info: " + util.inspect(accountInfo));
                    if (err){
                        // console.log('Authentication error! Please check your credentials and try again.');
                        warn('Authentication error! Please check your credentials and try again.');
                        return cb(err)
                    }
                    // NEED TO PUT USERID IN PARAMS!!
                    params.userId = accountInfo.user_id;
                    params.authkey = accountInfo.auth_key;
                    // LCM users can only use cbt_tunnels to start tunnel if secret is provided
                    if( accountInfo.subscription.localConManEnabled && !cmdArgs.secret ) {
                        startConManTunnelViaApi(api, params, ( err ) => { return cb(err) });
                    } else {
                        startTunnel(api, params, ( err ) => { return cb(err) });
                    }
                })
            })
        } catch (err) {
            return cb(err)
        }
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

