#! /usr/bin/env node

var _ = require('lodash'),
    request = require('request'),
    cbtSocket = (require('./cbt_tunnels')),
    argv = require('yargs').argv,
    fs = require('fs'),
    gfx = require('./gfx.js'),
    killLever = require('./utils.js').killLever,
    cbts = null,
    warn = gfx.warn,
    help = gfx.help,
    cbtUrls = {
        server: "crossbrowsertesting.com", 
        node: "app.crossbrowsertesting.com"
    },
    tType;


var typeCheck = function(){
    var count = 0;
    if(argv.h || argv.help){
        help();
        process.exit(0);
    }
    if((_.isUndefined(argv.username)) || (_.isNull(argv.username))){
        help();
        warn('You must specify a username.\n');
        return;
    }else if((_.isUndefined(argv.authkey)) || _.isNull(argv.authkey)){
        help();
        warn('You must specifiy an authkey.\n');
        return;
    }
    for(param in argv){
        if(param == 'tunnel' || param == 'simpleproxy' || param == 'webserver'){
            tType = param;
            count+=1;
        }
    }
    if(count>1){
        help();
        warn('Too many tunnel types specifed. You must specify the type of tunnel with one, and only one, of the following flags:\n  --simpleproxy\n  --webserver\n  --tunnel\nEvery flag excepting simpleproxy requires additional parameters.\n\n');
        return;
    }else if(count<=0){
        warn('No tunnel type specified. Defaulting to simpleproxy.');
        return 'simpleproxy';
    }else{
        return tType;
    }
}

var cmdParse = function(){
    cbtUrls = ((argv.test) ? {server: "test.crossbrowsertesting.com", node: "testapp.crossbrowsertesting.com"} : {server: "crossbrowsertesting.com", node: "app.crossbrowsertesting.com"});
    var tType = typeCheck();
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
                    userId:data.user_id
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
                            help();
                            warn('You must specify the proxy IP (--proxyIp) to create a tunnel.\n\n');
                        }else{
                            help();
                            warn('You must specify the proxy port (--proxyPort) to create a tunnel.\n\n');
                        }
                    break;
                    case 'webserver':
                        if(!_.isUndefined(argv.dir) && !_.isNull(argv.dir)){
                            if(_.isUndefined(argv.port)||_.isNull(argv.port)){
                                port = null;
                            }
                            var opts = {
                                directory:argv.dir,
                                port:argv.port
                            }
                            _.merge(params,opts);
                            startTunnel(params);
                        }else{
                            help();
                            warn('You must specifiy a directory (--dir) to create a webserver.\n\n');
                        }
                        break;
                    default:
                        console.log('How did you get here?');
                        process.exit(1);
                }
            }else{
                warn('Authentication error! Please check your credentials and try again.');
                process.exit(1);
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
            cb(response.statusCode);
        }
    });
}
 
 
var postTunnel = function(username,authkey,tType,cb){
    console.log('POST request to CBT for a tunnel...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPost = {
        url: 'http://'+cbtUrls.node+'/api/v3/tunnels',
        method: 'POST',
        headers: {
            authorization: 'authorized '+auth
        },
        qs: {
            tunnel_source: 'nodews',
            tunnel_type: tType
        }
    }

    request(optionsPost,function(error,response,body){
        if(!error && response.statusCode==200){
            body=JSON.parse(body);
            cb(null,body);
        }else{
            cb(error,null);
            console.log(error);
        }
    });
}

var putTunnel = function(username,authkey,params,data,cb){
    console.log('PUT request to CBT finalizing tunnel...');
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
            tunnel_source: 'nodews',
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
            console.log('Posted!');
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
                    putTunnel(argv.username,argv.authkey,params,data,function(err,data){
                        if(!err&&data){
                            console.log('PUT request successful!');
                            console.log('Completely connected!');
                            
                        }else{
                            console.log(err);
                        }
                    });
                }else{
                    console.log(err);
                    cbts.endWrap();
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

// var init = function(tType,username,authkey,params){
//         argv.cli = true;
//         argv.username = username;
//         argv.authkey = authkey;
//         argv.v = params.verbose;
//         argv.test = params.test;
//     }
// }

cmdParse();

