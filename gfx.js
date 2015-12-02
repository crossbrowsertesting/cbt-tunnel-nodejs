var CLI = require('clui'),
    clc = require('cli-color'),
    os  = require('os'),
	blessed = require('blessed'),
	_ = require('lodash'),
	utils = require('./utils.js');

var Line        = CLI.Line,
	LineBuffer	= CLI.LineBuffer,
	Gauge       = CLI.Gauge,
	Sparkline   = CLI.Sparkline,
	drawTimeout,
	inSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	outSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

module.exports = {
	draw: function(inbound,outbound) {
		console.log('\u001b[2J');
		console.log('\u001b[100;0H');
		var blankLine = new Line().fill().output();
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

	popper: function(message,subContent,params){
	    var screen = blessed.screen({
	      smartCSR: true
	    });
	    screen.key(['C-c', 'q','escape'], function(ch, key) {
	    	if(!params.v && params.context){
	    		params.context.spin();
	    	}
    		return screen.destroy();
  		});
	    screen.title = 'cbt_tunnels.js';
	    var box = blessed.text({
	    	ignoreLocked: ['C-c'],
			scrollable: true,
			alwaysScroll: true,
			top: 'center',
			left: 'center',
			align: 'center',
			width: '100%',
			height: '100%',
			content: message,
			tags: true,
			border: {
				type: 'line'
			},
			mouse:true,
			keys:true,
			scrollbar: {
				bg: '#778899'
			},
			style: {
				fg: 'grey',
				bg: 'black',
				border: {
				  fg: '#778899'
				}
			}
		});
	    
	    screen.append(box);

	    box.on('click',function(data){
	    	if(subContent==='dead'){
				params.context.end(function(err,killit){
	                if(!err&&killit==='killit'){
	                    process.exit(0);
	                }else if(err){
	                    console.log(err);
	                    setTimeout(function(){
	                        process.exit(1);
	                    },10000);
	                }
	            });
	            screen.destroy();
			}else if(subContent==='old'){
				screen.destroy();
				params.context.spin();
			}else{
				box.setContent(subContent);
				screen.render();
			}			
		});
	    // Focus our element.
	    box.focus();

	    // Render the screen.
	    screen.render();
	},

	msgs: {
		help: function(){
		    return "{bold}Creates a local connection to CrossBrowserTesting.com which allows you to test sites behind your firewall or to access web pages that are saved locally on your machine. In just a few seconds, you can establish a connection which allows you to do live testing, screenshots, or run Selenium scripts against any of the internal sites you have access to.  This command line version uses WSS (secure websockets over https, port 443) to create the local connection.  It can be scripted, so it is useful if you want to initiate a local connection programmatically before running automated javascript, screenshots, or selenium tests.{/bold}\n\n{left}There are three options provided for you to do this:\n\n{underline}simpleproxy:\n{/underline}This directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.\nBasic usage:\n    'node startTunnel.js --username USERNAME --authkey AUTHKEY --simpleproxy'\n\n{underline}webserver:\n{/underline}This allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local,\nprivileged sites.\nBasic usage:\n    'node tunnel_start.js --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR --port OPENPORT'\n\n{underline}tunnel:\n{/underline}The tunnel still routes through your computer to download site data, but it further directs that connection \nthrough a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).\nBasic usage:\n    'node tunnel_start.js --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'\n\n{underline}Further flags:\n{/underline}    '--kill KILLFILENAME'  |  Appending this flag allows you specify the\n                           |  name of a 'kill file' that if placed in \n                           |  the current directory will cause the \n                           |  program to gracefully shutdown.\n{underline}_                          |\n{/underline}    '--v'                  |  Specifiying this flag enables verbose \n                           |  mode; you'll see most of the\n                           |  traffic handling.\n{underline}_                          |\n{/underline}\n\n{bold}Exit: q, ESC, or CTRL+C{/bold}{/left}";
		}
	}


}