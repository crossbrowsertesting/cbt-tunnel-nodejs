var _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    help = gfx.help,
    version = require('./package.json').version,
    pacResolver = require('@crossbrowsertesting/pac-resolver'),
    fs = require('fs'),
    request = require('request'),
    util = require('util'),
    urlCache = {};

module.exports = {

    getPac: function(pac,cb){
        try{
            var pac = pacResolver(fs.readFileSync(pac));
            cb(null,pac);
        }catch(e){
            request(pac,function(err,response,body){
                if(err){
                    var reqErr = new Error("Could not resolve PAC file.");
                    cb(err);
                    return;
                }
                var pac = pacResolver(body);
                cb(null,pac);
            });
        }
    },

    setProxies: function(secure,proxy){
        if(secure){
            global.logger.info('HTTPS proxy set to '+proxy);
            process.env.https_proxy = proxy;
            process.env.HTTPS_PROXY = proxy;
        }else{
            global.logger.info('HTTP proxy set to '+proxy);
            process.env.http_proxy = proxy;
            process.env.HTTP_PROXY = proxy;
        }
    },

    checkVersion: function(data,params){
        var gfx = require('./gfx.js'),
            warn = gfx.warn,
            help = gfx.help;

        if(data.current!==version){
            if(_.indexOf(data.old,version)>-1){
                if(!params.verbose&&params.cmd&&!params.quiet){
                    params.context.spin({msg: data.msgs.old.replace('nnnn','\n\n\t')});
                }else{
                    warn(data.msgs.old.replace('nnnn','\n\n\t'));
                }
                return('client_verbose_log: using old version of node tunnel: '+version);
            }else{
                warn(data.msgs.dead.replace('nnnn','\n\n\t'));
                return('client_verbose_log: using dead version of node tunnel: '+version);
                params.context.endWrap();
            } 
        }else{
            if(!params.verbose&&params.cmd&&!params.quiet){
                params.context.spin();
            }
            return('client_verbose_log: using current version of node tunnel');
        }
    },

    killLever: function(cbts){
        process.on('SIGINT',function(){
            if(!_.isNull(cbts)&&!_.isUndefined(cbts)){
                cbts.endWrap();
            }
            global.logger.info('\nAttempting a graceful shutdown...');
        });

        process.on('SIGTERM',function(){
            global.logger.info('Attempting a graceful shutdown...');
            if(!_.isNull(cbts)&&!_.isUndefined(cbts)){
                cbts.endWrap();
            }
        });
    },

    determineHost: function(data,params,cb){
        var pac = params.pac;
        if(urlCache[data.host]){
            return cb(null,urlCache[data.host]);
        }else if(pac){
            var host = ((!data.host.startsWith('http://'))&&data.port==80) ? 'http://'+data.host : data.host;
            host = ((!host.startsWith('https://'))&&data.port==443) ? 'https://'+host : host;
            host = ((!host.startsWith('https://'))&&(!host.startsWith('http://'))) ? 'https://'+host : host;
            if(params.verbose){
                global.logger.debug('In determine host with data:')
                global.logger.debug(util.inspect(data));
            }
            pac(host+':'+data.port).then(function(res){
                if(res==='DIRECT'){
                    //host = data.host.replace('http://','').replace('https://','');
                    if(params.verbose){
                        global.logger.debug('Host determined for '+data.host+'; going direct:');
                        global.logger.debug({host:host,port:data.port});
                    }
                    urlCache[data.host] = {host:data.host,port:data.port,manipulateHeaders:false};
                    return cb(null,{host:data.host,port:data.port,manipulateHeaders:false});
                }else{
                    res = res.split(' ')[1];
                    var resArr = res.replace(';','').split(':');
                    if(params.verbose){
                        global.logger.debug('Host determined for '+data.host+'; not going direct:');
                        global.logger.debug({host:resArr[0],port:resArr[1]});
                    }
                    urlCache[data.host] = {host:resArr[0],port:resArr[1],manipulateHeaders:true};
                    return cb(null,{host:resArr[0],port:resArr[1],manipulateHeaders:true});
                }
            }).catch(function(err){
                if(params.verbose){
                    var msg = 'Error determining host for:\n';
                    msg+=util.inspect(data);
                    msg+='\n'+err.message;
                    cb(new Error(msg));
                }
            });
        }else if(data.tType==='tunnel'){
            if(params.verbose){
                global.logger.debug('Host determined; type tunnel:');
                global.logger.debug({host:data.proxyHost,port:data.proxyPort,manipulateHeaders:false});
            }
            return cb(null,{host:data.proxyHost,port:data.proxyPort,manipulateHeaders:false});
        }else{
            return cb(null,{host:data.host,port:data.port,manipulateHeaders:false});
        }
    }

}
