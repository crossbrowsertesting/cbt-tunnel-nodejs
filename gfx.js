var CLI = require('clui'),
    clc = require('cli-color'),
    os  = require('os'),
	_ = require('lodash'),
	utils = require('./utils.js');

var Line        = CLI.Line,
	LineBuffer	= CLI.LineBuffer,
	Gauge       = CLI.Gauge,
	Sparkline   = CLI.Sparkline,
	drawTimeout,
	inSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	outSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	error	  = clc.red.bold;

module.exports = {
	draw: function(inbound,outbound,old,msg,tType) {
		var typeMsg;
		switch(tType){
			case 'simpleproxy':
				typeMsg = '\nConnected for internal websites:\n\nThis tunnel allows live, screenshots, or selenium tests to be run through your local network. For sites hosted on your computer, use the domain "local" as opposed to "localhost":\n\n\te.g. http://local';
				break;
			case 'webserver':
				typeMsg = '\nConnected for local HTML files:\n\nThis tunnel allows access to files in a specified directory and its subdirectory. By default, the server listens on the first open port from 8080-8089, but you may specify a custom port with the "--port" flag. To access the statically hosted directory, use "local". To specify a locally hosted static webpage for screenshots or otherwise, use local and the filename of the webpage:\n\n\te.g.\thttp://local\n\t\thttp://local/FILENAME';
				break;
			case 'tunnel':
				typeMsg = '\nConnected for proxy server:\n\nThis mode allows you to run live tests and snapshot tests through a proxy, specified by IP and port. For locally hosted sites, use the domain "local" as opposed to "localhost":\n\n\te.g. http://local';
				break;
			default:
				typeMsg = 'How did you get here...';
		}
		console.log('\u001b[2J');
		console.log('\u001b[100;0H');

		var blankLine = new Line().fill().output();

		if((!_.isNull(old))&&(!_.isUndefined(old))){
			var oldLine = new Line()
				.padding(2)
				.column(old.msg,200,[clc.bold.red])
                .fill()
                .output();
		}
		blankLine.output();

		if((!_.isNull(msg))&&!_.isUndefined(msg)){
			var msgLine = new Line()
				.padding(2)
				.column(msg,200,[clc.bold.red])
				.fill()
				.output();
		}
		blankLine.output();

		var connection = new Line()
			.padding (2)
			.column(typeMsg)
			.fill()
			.output();
		blankLine.output();

		inSeries.push(inbound);
		inSeries.shift();

		var inLine = new Line()
			.padding(2)
			.column('Inbound Requests/Sec  ', 20, [clc.cyan])
			.column(Sparkline(inSeries, ' reqs/sec'), 80)
			.fill()
			.output();

		outSeries.push(outbound);
		outSeries.shift();

		var outLine = new Line()
			.padding(2)
			.column('Outbound Packets/Sec ', 20, [clc.cyan])
			.column(Sparkline(outSeries, ' packets/sec'), 80)
			.fill()
			.output();

		blankLine.output();

		var quitLine = new Line()
			.padding(2)
			.column('(to quit cbt_tunnels, press ctrl+c)',100,[clc.cyan])
			.fill()
			.output();

		blankLine.output();
	},
	warn: function(message){
		console.log(error(message));
	},
	help: function(){
	    console.log(clc.bold("cbt_tunnels.js has three run modes:\n\n")+clc.underline("Internal Websites:")+"\nThis directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.\nBasic usage:\n    'cbt_tunnels --username USERNAME --authkey AUTHKEY'\n\n"+clc.underline("Local HTML Files:")+"\nThis allows you to test static sites that are on your computer but not currently hosted on a server.\nBasic usage:\n    'cbt_tunnels --authkey AUTHKEY --password PASSWORD --dir PATHTODIRECTORY (optional: --port OPENPORT)'\n\n"+clc.underline("Proxy Server:")+"\nThis tunnel directs the connection through a proxy of your choice.\nBasic usage:\n    'cbt_tunnels --username USERNAME --authkey AUTHKEY --proxyIp PROXYIP --proxyPort PROXYPORT'\n\n"+clc.underline("Further flags:")+"\n    '--kill KILLFILENAME'  |  Appending this flag allows you specify the\n                           |  name of a 'kill file' that if placed in \n                           |  the current directory will cause the \n                           |  program to gracefully shutdown.\n"+clc.underline("_                          |\n")+"    '--ready READYFILENAME'|  Specifiying this flag creates an \n                           |  empty file at the path specified\n                           |  when the cbt_tunnels is fully connected.\n"+clc.underline("_                          |\n")+"    '--v'                  |  Specifiying this flag enables verbose \n                           |  mode; you'll see most of the\n                           |  traffic handling.\n"+clc.underline("_                          |\n")+"\nFor instructions on scripting, please see: https://github.com/crossbrowsertesting/cbt-tunnel-nodejs\n");
	}
	


}