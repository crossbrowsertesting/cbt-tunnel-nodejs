var _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    help = gfx.help,
    version = require('./package.json').version,
    pacResolver = require('pac-resolver'),
    fs = require('fs'),
    request = require('request');

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
            console.log('HTTPS proxy set to '+proxy);
            process.env.https_proxy = proxy;
            process.env.HTTPS_PROXY = proxy;
        }else{
            console.log('HTTP proxy set to '+proxy);
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
            console.log('\nAttempting a graceful shutdown...');
        });

        process.on('SIGTERM',function(){
            console.log('Attempting a graceful shutdown...');
            if(!_.isNull(cbts)&&!_.isUndefined(cbts)){
                cbts.endWrap();
            }
        });
    },

    determineHost: function(data,pac,cb){
        if(pac){
            var host = (!(data.host.startsWith('http://')) && !(data.host.startsWith('https://'))) ? 'http://'+data.host : data.host;
            console.log('In determine host with data:')
            console.dir(data);
            console.dir(pac);
            pac(host+':'+data.port).then(function(res){
                console.log('past pac call');
                if(res==='DIRECT'){
                    console.log('GOING DIRECT');
                    return cb(null,{host:data.host,port:data.port});
                }else{
                    console.log('NOT GOING DIRECT');
                    res = res.split(' ')[1];
                    var resArr = res.replace(';','').split(':');
                    console.dir({host:resArr[0],port:resArr[1]})
                    return cb(null,{host:resArr[0],port:resArr[1]});

                }
            }).catch(function(err){
                console.log('Error determining host for:');
                console.dir(data);
                console.log(err.message);
            });
        }else if(data.tType==='tunnel'){
            console.log('TYPE IS TUNNEL:');
            console.dir({host:data.proxyHost,port:data.proxyPort});
            return cb(null,{host:data.proxyHost,port:data.proxyPort});
        }else{
            return cb(null,{host:data.host,port:data.port});
        }
    }

}
