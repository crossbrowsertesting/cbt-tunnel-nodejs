#! /usr/bin/env node

var tunnelStart = require('./tunnel_start.js'),
    argv = require('yargs').argv;
    argv.cmd = true;

tunnelStart.start(argv,function(err){
    if(err){
        logger.error(err);
        process.exit(1);
    }
});
