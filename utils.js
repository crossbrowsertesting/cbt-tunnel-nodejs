var NPM_CONFIG_LOGLEVEL = 'verbose';
var _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    help = gfx.help,
    version = '0.0.17';

module.exports = {
    checkVersion: function(data,params){
        var gfx = require('./gfx.js'),
            warn = gfx.warn,
            help = gfx.help;
        data=JSON.parse(data);
        if(data.current!==version){
            if(_.indexOf(data.old,version)>-1){
                params.context.spin({msg: data.msgs.old.replace('nnnn','\n\n\t')});
            }else{
                warn(data.msgs.dead.replace('nnnn','\n\n\t'));
                warn('To upgrade cbt_tunnels: npm update -g cbt_tunnels');
            }
        }else{
            params.context.spin(false);
        }
    },
    killLever: function(cbts){
        process.on('SIGINT',function(){
            console.log('\nAttempting a graceful shutdown...');
            if(!_.isNull(cbts)&&!_.isUndefined(cbts)){
                cbts.end(function(err,killit){
                    if(!err&&killit==='killit'){
                        process.exit(0);
                    }else{
                        if(err){
                            console.log(err);
                        }
                        setTimeout(function(){
                            process.exit(1);
                        },10000);
                    }
                });
            }
        })

        process.on('SIGTERM',function(){
            console.log('Attempting a graceful shutdown...');
            if(!_.isNull(cbts)&&!_.isUndefined(cbts)){
                cbts.end(function(err,killit){
                    if(!err&&killit==='killit'){
                        process.exit(0);
                    }else{
                        if(err){
                            console.log(err);
                        }
                        setTimeout(function(){
                            process.exit(1);
                        },10000);
                    }
                });
            }
        })
    } 

}