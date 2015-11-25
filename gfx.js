var CLI = require('clui'),
    clc = require('cli-color'),
    os  = require('os'),
    //blessed = require('blessed')
	term = require( 'terminal-kit' ).terminal,
	blessed = require('blessed'),
	_ = require('lodash'),
	utils = require('./utils.js');

var Line        = CLI.Line,
	Gauge       = CLI.Gauge,
	Sparkline   = CLI.Sparkline,
	drawTimeout,
	inSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
	outSeries = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

module.exports = {
	draw: function(inbound,outbound) {
		term.eraseDisplay();
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
		    return "{bold}cbt_tunnels.js is a simple program that allows you to test websites that are otherwise inaccessible to our service.{/bold}\n\n{left}There are three options provided for you to do this:\n\n{underline}simpleproxy:\n{/underline}This directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.\nBasic usage:\n    'node startTunnel.js --username USERNAME --authkey AUTHKEY --simpleproxy'\n\n{underline}webserver:\n{/underline}This allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local,\nprivileged sites.\nBasic usage:\n    'node tunnel_start.js --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR --port OPENPORT'\n\n{underline}tunnel:\n{/underline}The tunnel still routes through your computer to download site data, but it further directs that connection \nthrough a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).\nBasic usage:\n    'node tunnel_start.js --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'\n\n{underline}Further flags:\n{/underline}    '--kill KILLFILENAME'  |  Appending this flag allows you specify the\n                           |  name of a 'kill file' that if placed in \n                           |  the current directory will cause the \n                           |  program to gracefully shutdown.\n{underline}_                          |\n{/underline}    '--v'                  |  Specifiying this flag enables verbose \n                           |  mode; you'll see most of the\n                           |  traffic handling.\n{underline}_                          |\n{/underline}\n\n{bold}Exit: q, ESC, or CTRL+C{/bold}{/left}";
		},

		old: function(){
			return "{bold}Your version of cbt_tunnels is out-of-date, but still supported. In order to update it now:{/bold}\n\n - Exit this program\n - Navigate to the node_modules directory where cbt_tunnels is installed\n - Run: npm remove cbt_tunnels\n - Run: npm install cbt_tunnels\n\n(hit q, ESC, or CTRL+C to exit this screen)";
		},

		dead: function(){
			return "{bold}Your version of cbt_tunnels is out-of-date and no longer supported. You cannot connect to the CrossBrowserTesting servers with it. In order to update it now:{/bold}\n\n - Exit this program\n - Navigate to the node_modules directory where cbt_tunnels is installed\n - Run: npm remove cbt_tunnels\n - Run: npm install cbt_tunnels\n\n(hit q, ESC, or CTRL+C to exit)";
		}
	}


}