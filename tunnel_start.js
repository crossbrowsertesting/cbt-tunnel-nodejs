var _ = require('lodash'),
    request = require('request'),
    cbtSocket = (require('./cbt_tunnels')),
    argv = require('yargs')
        .env('CBT_TUNNELS')
        .argv,
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
    valid = ['proxyUser','proxyPass','httpsProxy','httpProxy','_','ready','username','authkey','$0','simpleproxy','tunnel','webserver','cmd','proxyIp','proxyPort','port','dir','verbose','quiet', 'kill','test','tunnelname'];



var cmdParse = function(cb){
    cbtUrls = ((argv.test) ? {server: "test.crossbrowsertesting.com", node: "testapp.crossbrowsertesting.com"} : {server: "crossbrowsertesting.com", node: "crossbrowsertesting.com"});
    var tType = argv.tType;
    if(!_.isUndefined(tType)&& !_.isNull(tType)){
        accountInfo(argv.username,argv.authkey,function(err,data){
            if(!err&&data){
                console.log('Got user account info!');
                var params = {
                    urls: cbtUrls,
                    verbose: argv.verbose,
                    username: argv.username,
                    authkey: data.auth_key, 
                    tType:tType,
                    userId:data.user_id,
                    cb: cb,
                    tunnelName: argv.tunnelname
                }
                if(cmd){
                    params.cmd = true;
                }
                if(!_.isUndefined(argv.ready)&&!_.isNull(argv.ready)){

                    params.ready = argv.ready;
                }
                switch(tType){
                    case 'simpleproxy':
                        startTunnel(params);
                    break;
                    case 'tunnel':
                        if(!_.isUndefined(argv.proxyIp) && !_.isUndefined(argv.proxyPort) && !_.isNull(argv.proxyIp) && !_.isNull(argv.proxyPort) && (!(_.isUndefined(argv.proxyUser)!=_.isUndefined(argv.proxyPass)))){
                            var opts = {
                                proxyIp:argv.proxyIp,
                                proxyPort:argv.proxyPort,
                                bytecode:true
                            }
                            if(!_.isUndefined(argv.proxyPass)&&!_.isUndefined(argv.proxyUser)){
                                opts.proxyPass = argv.proxyPass;
                                opts.proxyUser = argv.proxyUser;
                            }
                            _.merge(params,opts);
                            startTunnel(params);
                        }else if(_.isUndefined(argv.proxyIp)||_.isNull(argv.proxyIp)){
                            help();
                            warn('You must specify the proxy IP (--proxyIp) to create a tunnel.\n\n');
                        }else if((_.isUndefined(argv.proxyUser)!=_.isUndefined(argv.proxyPass))){
                            help();
                            warn('You must specify both a proxy user (--proxyUser) and a proxy password (--proxyPass) to use basic authentication with the proxy option.');
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
        url: 'https://'+cbtUrls.node+'/api/v3/account',
        method: 'GET',
        headers: {
            authorization: 'authorized '+auth
        }
    }
    
    request(optionsPost,function(error,response,body){
        if(!error && body && response.statusCode==200){
            body=JSON.parse(body);
            cb(null,body);
        }else if(error){
            console.log(error)
            cb(error);
        }else{
            console.log(response.statusCode);
            cb(response.statusCode);
        }
    });
}
 
 
var postTunnel = function(username,authkey,tType,tunnelName,cb){
    console.log('POST request to CBT for a tunnel...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPost = {
        url: 'https://'+cbtUrls.node+'/api/v3/tunnels',
        method: 'POST',
        headers: {
            authorization: 'authorized '+auth
        },
        qs: {
            tunnel_source: 'nodews',
            tunnel_type: tType,
            tunnel_name: tunnelName
        }
    }

    request(optionsPost,function(error,response,body){
        if(!error && response.statusCode==200){
            body=JSON.parse(body);
            cb(null,body);
        }else{
            body = JSON.parse(body);
            console.log('Error on post request:');
            console.log(body.status);
            cb(body.message,null);    
        }
    });
}

var putTunnel = function(username,authkey,params,data,cb){
    console.log('PUT request to CBT finalizing tunnel...');
    var auth = (new Buffer(username+':'+authkey)).toString('base64');
    var optionsPut = {
        url: 'https://'+cbtUrls.node+'/api/v3/tunnels',
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
    postTunnel(argv.username,argv.authkey,params.tType,params.tunnelName,function(err,data){
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
                            params.cb(null);
                            
                        }else{
                            console.log(err);
                            params.cb(err);
                            cbts.endWrap();
                        }
                    });
                }else{
                    params.cb(err);
                    cbts.endWrap();
                }
            });
        }else{
            console.log(err);
            setTimeout(function(){
                params.cb(err);
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
        var u = _.union(_.keys(params),valid);
        var v = _.isEqual(u.sort(),valid.sort());
        if(!v){
            help();
            warn("I can't make sense of some of the flags you've provided, like: \n    "+_.difference(u.sort(),valid.sort())+"\n");
            process.exit(1);
        }
        if(params.quiet){
            process.env.CBT_TUNNELS_QUIET_MODE = true;
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
        cmdParse(function(err){
            if(!err){
                cb(null);
            }else{
                cb(err);
            }
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

