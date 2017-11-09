#! /usr/bin/env node

var tunnelStart = require('./tunnel_start.js'),
    argv = require('yargs').argv,
    gfx = require('./gfx.js'),
    help = gfx.help,
    warn = gfx.warn;
    argv.cmd = true;


tunnelStart.start(argv,function(err){
    if(err){
    	warn(err);
    	help();
        process.exit(1);
    }
});
