#! /usr/bin/env node

var _ = require('lodash'),
    request = require('request'),
    cbtSocket = (require('./cbt_tunnels')),
    argv = require('yargs').argv,
    fs = require('fs'),
    cbts = null,
    gfx = require('./gfx.js'),
    msgs = gfx.msgs,
    popper = gfx.popper,
    cbtUrls = {
        server: "crossbrowsertesting.com", 
        node: "app.crossbrowsertesting.com"
    },
    tType;

var debug = _.filter(process.argv, function(arg){
    return arg.toString().indexOf('debug') > -1 ;
})[0];


var argCheck = function(){
    var count = 0;
    if(argv.h || argv.help){
        msgs.help();
    }
    if((_.isUndefined(argv.username)) || (_.isNull(argv.username))){
        popper('You must specify a username.\n(click here for help, or run with the --h or --help flags)',msgs.help(),argv);
        return;
    }else if((_.isUndefined(argv.authkey)) || _.isNull(argv.authkey)){
        popper('You must specifiy an authkey.\n(click here for help, or run with the --h or --help flags)',msgs.help(),argv);
        return;
    }
    for(param in argv){
        if(param == 'tunnel' || param == 'simpleproxy' || param == 'webserver'){
            tType = param;
            count+=1;
        }
    }
    if(count>1){
        popper('Too many tunnel types specifed. You must specify the type of tunnel with one,\nand only one, of the following flags:\n  --simpleproxy\n  --webserver\n  --tunnel\nEvery flag excepting simpleproxy requires additional parameters.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),argv);
        return;
    }else if(count<=0){
        console.log('No tunnel type specified. Defaulting to simpleproxy.');
        return 'simpleproxy';
    }else{
        return tType;
    }
}

var cmdParse = function(){
    cbtUrls = ((argv.test) ? {server: "test.crossbrowsertesting.com", node: "testapp.crossbrowsertesting.com"} : {server: "crossbrowsertesting.com", node: "app.crossbrowsertesting.com"});
    var tType = argCheck();
        if(!_.isUndefined(tType)&& !_.isNull(tType)){
        accountInfo(argv.username,argv.authkey,function(err,data){
            if(!err&&data){
                console.log('Got user account info!');
                var params = {
                    urls: cbtUrls,
                    verbose: argv.v,
                    username: argv.username,
                    authkey: data.auth_key, 
                    tType:tType,
                    userId:data.user_id,
                }
                switch(tType){
                    case 'simpleproxy':
                        startTunnel(params);
                    break;
                    case 'tunnel':
                        if(!_.isUndefined(argv.proxyIp) && !_.isUndefined(argv.proxyPort) && !_.isNull(argv.proxyIp) && !_.isNull(argv.proxyPort)){
                            var opts = {
                                host:argv.proxyIp,
                                proxyPort:argv.proxyPort,
                                bytecode:true
                            }
                            _.merge(params,opts);
                            startTunnel(params);
                        }else if(_.isUndefined(argv.proxyIp)||_.isNull(argv.proxyIp)){
                            popper('You must specify the proxy IP (--proxyIp) to create a tunnel.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),params);
                        }else{
                            popper('You must specify the proxy port (--proxyPort) to create a tunnel.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),params);
                        }
                    break;
                    case 'webserver':
                        if(!_.isUndefined(argv.dir) && !_.isUndefined(argv.port) && !_.isNull(argv.dir) && !_.isNull(argv.port)){
                            var opts = {
                                directory:argv.dir,
                                port:argv.port
                            }
                            _.merge(params,opts);
                            startTunnel(params);
                        }else if(_.isUndefined(argv.dir)||_.isNull(argv.dir)){
                            popper('You must specifiy a directory (--dir) to create a webserver.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),params);
                        }else{
                            popper('You must specifiy a server port (--port) to create a webserver.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),params);
                        }
                        break;
                    default:
                        console.log('How did you get here?');
                        process.exit(1);
                }
            }else{
                console.log(err);
                setTimeout(function(){
                    process.exit(1);
                },10000);
            }
        });
    }
}

var accountInfo = function(username,authkey,cb){
    console.log('Getting account info...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPost = {
        url: 'http://'+cbtUrls.node+'/api/v3/account',
        method: 'GET',
        headers: {
            authorization: 'authorized '+auth
        }
    }

    request(optionsPost,function(error,response,body){
        if(!error && body && response.statusCode==200){
            body=JSON.parse(body);
            cb(null,body);
        }else{
            cb(error,response.statusCode);
            console.log(error);
        }
    });
}
 
 
var postTunnel = function(username,authkey,tType,cb){
    console.log('Posting tunnel...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPost = {
        url: 'http://'+cbtUrls.node+'/api/v3/tunnels',
        method: 'POST',
        headers: {
            authorization: 'authorized '+auth
        },
        qs: {
            tunnel_source: 'chromeext',
            tunnel_type: tType
        }
    }

    request(optionsPost,function(error,response,body){
        if(!error && response.statusCode==200){
            body=JSON.parse(body);
            console.log('Posted!');
            cb(null,body);
        }else{
            cb(error,null);
            console.log(error);
        }
    });
}

var putTunnel = function(username,authkey,params,data,cb){
    console.log('Put--ting?-- tunnel...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPut = {
        url: 'http://'+cbtUrls.node+'/api/v3/tunnels',
        followRedirect:false,
        method: 'PUT',
        headers: {
            authorization: 'authorized '+auth
        },
        qs: {
            local_directory: (_.isUndefined(params.directory) ? '' : params.directory),
            local_ip:'localhost',
            local_port: (_.isUndefined(params.port) ? '' : params.port),
            message:'SUCCESS',
            state:'1',
            tunnel_source: 'chromeext',
            tunnel_type: params.tType
        }
    }

    optionsPut.url=optionsPut.url+'/'+data.tunnel_id;

    request(optionsPut,function(error,response,body){
        if(!error&&response.statusCode==200){
            body=JSON.parse(body);
            cb(null,body);
        }else{
            console.log(error);
        }
    });
}


var startTunnel = function(params){
    postTunnel(argv.username,argv.authkey,params.tType,function(err,data){
        if(!err&&data){
            var opts = {
                tcpPort:data.remote_port,
                cbtServer:data.remote_server,
                tp:data.tunnel_authkey,
                tid:data.tunnel_id,
                tu:data.tunnel_user
            }
            _.merge(params,opts);
            cbts = new cbtSocket(params);
            cbts.start(function(err,socket){
                if(!err&&socket){
                    console.log('Posted!');
                    putTunnel(argv.username,argv.authkey,params,data,function(err,data){
                        if(!err&&data){
                            console.log('Put...ed? Placed! Placed...');
                            console.log('Completely connected!');
                        }else{
                            console.log(err);

                        }
                    });
                }else{
                    console.log(err);
                    cbts.end(function(err){
                        if(!err){
                            process.exit(1);
                        }else{
                            console.log(err);
                            setTimeout(function(){
                                process.exit(1);
                            },10000);
                        }
                    })
                }
            });
        }else{
            console.log(err);
            setTimeout(function(){
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
                            cbts.end(function(err,killit){
                                if(!err&&killit==='killit'){
                                    process.exit(0);
                                }else if(err){
                                    console.log(err);
                                    setTimeout(function(){
                                        process.exit(1);
                                    },10000);

                                }
                            });
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

var isDebug = function(){
    switch(debug){
        case "--tunnel-debug":
            var cbts = new cbtSocket({debug: true, tType: 'tunnel'});
            cbts.start();
        break;

        case "--server-debug":
            var cbts = new cbtSocket({debug: true, tType: 'webserver', directory: '/'});
            cbts.start();
        break;

        case "--proxy-debug":
            var cbts = new cbtSocket({debug: true, tType: 'proxy'});
            cbts.start();
            break;

        default:
            if((Object.keys(argv)).length<=2){
                popper('You need to specify at least a few parameters to create a tunnel.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),argv);
            }else{
                cmdParse();
            }
    }
};

// var init = function(tType,username,authkey,params){
//     argv.cli = true;
//     argv.username = username;
//     argv.authkey = authkey;
//     argv.v = params.verbose;
//     argv.test = params.test;
//     switch(tType){
//         case 'simpleproxy':
//             argv.simpleproxy = true;
//             cmdParse();
//         break;
//         case 'webserver':
//             argv.webserver = true;
//             argv.dir = params.dir;
//             argv.port = params.port;
//             cmdParse();
//         break;
//         case 'tunnel':
//             argv.tunnel = true;
//             argv.proxyIp = params.proxyIp;
//             argv.proxyPort = params.proxyPort;
//             cmdParse();
//         break;
//         default:
//             popper('Incorrect arguments specified.\n\n{bold}(click here for help, or run this again with the --h or --help flag)\n\nExit: q, ESC, or CTRL+C{/bold}',msgs.help(),argv);
//         break;
//     }
// }

isDebug();

