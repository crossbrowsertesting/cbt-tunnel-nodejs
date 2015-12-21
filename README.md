##cbt_tunnels.js 

#####Creates a local connection to CrossBrowserTesting.com which allows you to test sites behind your firewall or to access web pages that are saved locally on your machine. In just a few seconds, you can establish a connection which allows you to do live testing, screenshots, or run Selenium scripts against any of the internal sites you have access to.  This command line version uses WSS (secure websockets over https, port 443) to create the local connection.  It can be scripted, so it is useful if you want to initiate a local connection programmatically before running automated javascript, screenshots, or selenium tests.

#####Install:
	
	npm install -g cbt_tunnels

#####Scripted usage:
	
	var cbt = require('cbt_tunnels');

There are three options provided for you to do this:

#####simpleproxy:

	This directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.

	Basic usage: 
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --simpleproxy'
		Scripted:	'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tType":"simpleproxy"},function(err){ if(!err) do stuff })'

#####webserver:<br>

	This allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local or privileged sites.
	
	Basic usage: 
		Command line: 'cbt_tunnels --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR (optional: --port OPENPORT)'
		Scripted:	'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tType":"webserver","dir":"PATH/TO/DIR", (optional: "port":"PORT") },function(err){ if(!err) do stuff })'

#####tunnel:<br>
	The tunnel still routes through your computer to download site data, but it further directs that connection through a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).

	Basic usage: 
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'
		Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tType":"tunnel","proxyIp":"PROXYIP","proxyPort":"PROXYPORT"},function(err){ if(!err) do stuff })'

#####Further flags:<br>
	Kill file:
	Command line: '--kill KILLFILENAME'
	Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tType":"simpleproxy","kill":"KILLFILENAME"},function(err){ if(!err) do stuff })'
		The kill file option allows you specify the name of a 'kill file' that if placed in the current directory will cause the program to gracefully shutdown.
	Command line: '--v'
	Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tType":"simpleproxy","v":true},function(err){ if(!err) do stuff })'
		Specifiying this flag enables verbose mode; you'll see most of the traffic handling.
