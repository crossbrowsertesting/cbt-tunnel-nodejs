var NPM_CONFIG_LOGLEVEL = 'verbose';
var fs = require('fs'),
    _ = require('lodash'),
	hf = require('hash-files'),
    gfx = require('./gfx.js'),
    popper = gfx.popper,
    msgs = gfx.msgs,
    shell = require('shelljs/global'),
    request = require('request');

module.exports = {
	IAM: function(mode,cb){
        switch(mode){
    		case('dir'):
                hf({files:['./cbt_tunnels.js','./test.js','./gfx.js','./utils.js','./package.json','./tunnel_start.js'],algorithm:'sha512'},function(err,hash){
        			if(!err&&hash){
        				cb(null,hash);

        			}else{
        				cb(err,null);
        			}
        		});
                break;
            case('tar'):
                hf({files:['../test/cbt_tunnels.js.tar'],algorithm:'sha512'},function(err,hash){
                    if(!err&&hash){
                        cb(null,hash);

                    }else{
                        cb(err,null);
                    }
                });
                break;
            default:
            break;
        }
	},
	// versionCheck: function(cb){
 //        npm.load({loglevel:'silent' }, function (er, npm) {
 //            if (er) return cb(er)
 //            npm.commands.ll(function(err,data){
 //                version = data.version;
 //                npm.commands.outdated('cbt@'+version,function(err,data){
 //                    if(!_.isEmpty(data)){
 //                    	console.log(data);
 //                    	console.dir(msgs);
 //                   		return popper(msgs.old(),'update',params);

 //                    }
 //                });
 //            });
 //        });
 //    },
    // update: function(){
    //     console.log('herp');
    //     request
    //       .get('http://52.26.173.240:9000/cbt_tunnels.tar')
    //       .on('error', function(err) {
    //         console.log(err)
    //     })
    //     .pipe(fs.createWriteStream('../herp.tar'));

        // cd('..');
        // cp('./cbt_tunnels.js,./gfx.js,./package.json,./tunnel_start.js,./utils.js','../test/');
        // rm('-rf','./cbt_tunnels.js');
        // cd('../test');
        // cp('./cbt_tunnels.js,./gfx.js,./package.json,./tunnel_start.js,./utils.js','../cbt_tunnels.js/');
        // cd('../cbt_tunnels.js');
        // exec('npm install');
    //},
    killLever: function(cbts){
        process.on('SIGINT',function(){
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