var NPM_CONFIG_LOGLEVEL = 'verbose';
var _ = require('lodash'),
    gfx = require('./gfx.js'),
    popper = gfx.popper,
    msgs = gfx.msgs,
    version = '0.0.14';

module.exports = {
    checkVersion: function(data,params){
        var gfx = require('./gfx.js'),
            popper = gfx.popper;
        data=JSON.parse(data);
        if(data.current!==version){
            if(_.indexOf(data.old,version)>-1){
                popper(data.msgs.old.replace('nnnn','\n'),'old',params);
            }else{
                popper(data.msgs.dead.replace('nnnn','\n'),'dead',params);
            }
        }else{
            params.context.spin();
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