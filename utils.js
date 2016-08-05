var _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    help = gfx.help,
    version = '0.0.27';

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
                params.context.endWrap();
            } 
        }else{
            if(!params.verbose&&params.cmd){
                params.context.spin();
            }
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
    } 

}