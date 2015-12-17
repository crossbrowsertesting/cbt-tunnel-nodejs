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
	draw: function(inbound,outbound,old,tType) {
		var typeMsg;
		switch(tType){
			case 'simpleproxy':
				typeMsg = '\nConnected as simpleproxy:\n\nThis tunnel allows live, screenshots, or selenium tests to be run through your local network. For sites hosted on your computer, use the domain "local" as opposed to "localhost":\n\n\te.g. http://local';
				break;
			case 'webserver':
				typeMsg = '\nConnected as webserver:\n\nThis tunnel allows access to files in a specified directory and its subdirectory. By default, the server listens on the first open port from 8080-8089, but you may specify a custom port with the "--port" flag. To access the statically hosted directory, use "local". To specify a locally hosted static webpage for screenshots or otherwise, use local and the filename of the webpage:\n\n\te.g.\thttp://local\n\t\thttp://local/FILENAME';
				break;
			case 'tunnel':
				typeMsg = '\nConnected as proxy tunnel:\n\nThis mode allows you to run live tests and snapshot tests through a proxy, specified by IP and port. For locally hosted sites, use the domain "local" as opposed to "localhost":\n\n\te.g. http://local';
				break;
			default:
				typeMsg = 'How did you get here...';
		}
		console.log('\u001b[2J');
		console.log('\u001b[100;0H');
		var blankLine = new Line().fill().output();
		if((!_.isNull(old))&&(!_.isUndefined(old))){
			console.log(old);
			var oldLine = new Line()
				.padding(2)
				.column(old.msg,200,[clc.bold.red])
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

	// popper: function(message,subContent,params){
	//     var screen = blessed.screen({
	//       smartCSR: true
	//     });
	//     screen.key(['C-c', 'q','escape'], function(ch, key) {
	//     	if(!params.v && params.context){
	//     		params.context.spin();
	//     	}
 //    		return screen.destroy();
 //  		});
	//     screen.title = 'cbt_tunnels.js';
	//     var box = blessed.text({
	//     	ignoreLocked: ['C-c'],
	// 		scrollable: true,
	// 		alwaysScroll: true,
	// 		top: 'center',
	// 		left: 'center',
	// 		align: 'center',
	// 		width: '100%',
	// 		height: '100%',
	// 		content: message,
	// 		tags: true,
	// 		border: {
	// 			type: 'line'
	// 		},
	// 		mouse:true,
	// 		keys:true,
	// 		scrollbar: {
	// 			bg: '#778899'
	// 		},
	// 		style: {
	// 			fg: 'grey',
	// 			bg: 'black',
	// 			border: {
	// 			  fg: '#778899'
	// 			}
	// 		}
	// 	});
	    
	//     screen.append(box);

	//     box.on('click',function(data){
	//     	if(subContent==='dead'){
	// 			params.context.end(function(err,killit){
	//                 if(!err&&killit==='killit'){
	//                     process.exit(0);
	//                 }else if(err){
	//                     console.log(err);
	//                     setTimeout(function(){
	//                         process.exit(1);
	//                     },10000);
	//                 }
	//             });
	//             screen.destroy();
	// 		}else if(subContent==='old'){
	// 			screen.destroy();
	// 			params.context.spin();
	// 		}else{
	// 			box.setContent(subContent);
	// 			screen.render();
	// 		}			
	// 	});
	//     // Focus our element.
	//     box.focus();

	//     // Render the screen.
	//     screen.render();
	// },
	warn: function(message){
		console.log(error(message));
	},
	help: function(){
	    console.log(clc.bold("cbt_tunnels.js has three run modes:\n\n")+clc.underline("simpleproxy:")+"\nThis directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.\nBasic usage:\n    'node startTunnel.js --username USERNAME --authkey AUTHKEY --simpleproxy'\n\n"+clc.underline("webserver:")+"\nThis allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local, privileged sites.\nBasic usage:\n    'node tunnel_start.js --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR --port OPENPORT'\n\n"+clc.underline("tunnel:")+"\nThe tunnel still routes through your computer to download site data, but it further directs that connection through a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).\nBasic usage:\n    'node tunnel_start.js --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'\n\n"+clc.underline("Further flags:")+"\n    '--kill KILLFILENAME'  |  Appending this flag allows you specify the\n                           |  name of a 'kill file' that if placed in \n                           |  the current directory will cause the \n                           |  program to gracefully shutdown.\n"+clc.underline("_                          |\n")+"    '--v'                  |  Specifiying this flag enables verbose \n                           |  mode; you'll see most of the\n                           |  traffic handling.\n"+clc.underline("_                          |\n")+"\n\n");
	}
	


}