## Local Connection with NodeJs 

Creates a local connection (tunnel) to CrossBrowserTesting.com which allows you to test sites behind your firewall or to access web pages that are saved locally on your machine. 

In just a few seconds, you can establish a connection which allows you to do live testing, screenshots, or run Selenium scripts against any of the internal sites you have access to.  

This command line version uses WSS (secure websockets over https, port 443) to create the local connection.  It can be scripted, so it is useful if you want to initiate a local connection programmatically before running automated javascript, screenshots, or selenium tests.

##### Install:	
	npm install -g cbt_tunnels

##### Scripted usage:	
	var cbt = require('cbt_tunnels');

There are three options provided for you to do this:

##### Internal websites:
	This directs requests from CBT browsers to your computer to test sites behind your firewall
	that would otherwise be inaccessible.

	Basic usage: 
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY'
		Scripted:	'cbt.start({"username":"USERNAME","authkey":"AUTHKEY"},function(err){ if(!err) do stuff })'

##### Local HTML Files:
	This allows you to host static files on your computer that are not currently hosted on a server, 
	as well as routing through your computer to access local or privileged sites.
	
	Basic usage: 
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --dir PATHTODIRECTORY (optional: --port OPENPORT)'
		Scripted:	'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","dir":"PATHTODIRECTORY", (optional: "port":"PORT") },function(err){ if(!err) do stuff })'

##### Proxy Server:
	The tunnel still routes through your computer to download site data, but it further directs that 
	connection through a proxy of your choosing. By default the CBT tunnel uses your local machine
	to act as an HTTP proxy for web traffic from our remote browsers. Sometimes it is desirable
	to use a remote proxy rather than your local machine. For example, if you wanted for it to
	appear as though your traffic were coming from the United Kingdom, proxying through a server
	there would allow for that.

	Basic usage: 
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --proxyIp PROXYIP --proxyPort PROXYPORT'
		Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","proxyIp":"PROXYIP","proxyPort":"PROXYPORT"},function(err){ if(!err) do stuff })'

	Usage with basic authentication:
		Command line: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --proxyIp PROXYIP --proxyPort PROXYPORT --proxyUser PROXYUSER --proxyPass PROXYPASS'
		Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","proxyIp":"PROXYIP","proxyPort":"PROXYPORT","proxyUser:":"PROXYUSER","proxyPass":"PROXYPASS"},function(err){ if(!err) do stuff })'

##### Note:
	All flags may also be set as environment variables beginning with CBT_TUNNELS.
	e.g. Instead of typing --username, you may instead set the environment variable
	CBT_TUNNELS_USERNAME to the desired username.

##### Further Options:

	Tunnel name:
		There are some cases where multiple tunnels might be necessary, such as when working with multiple 
		development environments. In this case, we provide the option to name tunnels so that they may be 
		specifically selected for use in various tests: in the advanced settings in the UI, or by specifying
		the property "tunnel_name" in the JSON sent to the API.

		Command line: '--tunnelname TUNNELNAME'
		Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","tunnelname":"TUNNELNAME"},function(err){ if(!err) do stuff })'

	HTTP_PROXY:
		Some corporations use an HTTP proxy for all outbound web traffic. The CBT tunnel communicates via wss
		over port 443 to CrossBrowserTesting.com server to initiate a local connection. By default, it will
		try to connect directly to CrossBrowserTesting. If you have an HTTP proxy that it must route through, 
		use this option to do so. It works by temporarily setting the HTTP_PROXY environment variable, so may
		be redundant in cases wherein it is already set.

		Basic usage:
			Command line: '--httpProxy HTTPPROXY'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","httpProxy":"HTTPPROXY"},function(err){ if(!err) do stuff })'

		Usage with basic authentication:
			Command line: '--httpProxy PROXYUSER:PROXYPASS@HTTPPROXY'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","httpProxy":"PROXYUSER:PROXYPASS@HTTPPROXY"},function(err){ if(!err) do stuff })'

	HTTPS_PROXY:
		Has the same functionality as HTTP_PROXY but sets the HTTPS_PROXY environment variable instead.

		Basic usage:
			Command line: '--httpsProxy HTTPSPROXY'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","httpsProxy":"HTTPSPROXY"},function(err){ if(!err) do stuff })'

		Usage with basic authentication:
			Command line: '--httpsProxy PROXYUSER:PROXYPASS@HTTPSPROXY'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","httpsProxy":"PROXYUSER:PROXYPASS@HTTPSPROXY"},function(err){ if(!err) do stuff })'

	Kill file:
		The kill file option allows you specify the name of a 'kill file' that if placed in the current 
		directory will cause the program to gracefully shutdown.

		Basic usage: 
			Command line: '--kill KILLFILENAME'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","kill":"KILLFILENAME"},function(err){ if(!err) do stuff })'

	Ready file:
		When the tunnel is up-and-running, an empty file will be placed in the path specified by the user.

		Basic usage:
			Command line: '--ready READYFILENAME'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","ready":"READYFILENAME"},function(err){ if(!err) do stuff })'

	Verbose mode:
		Specifying this flag enables verbose mode; you'll see most of the traffic handling.

		Basic usage:
			Command line: '--verbose'
			Scripted: 'cbt.start({"username":"USERNAME","authkey":"AUTHKEY","verbose":true},function(err){ if(!err) do stuff })'

	Stop function:
		This function takes no parameters and kills the tunnel gracefully.
		Basic usage:
			Scripted: 'cbt.stop()'
	Status function:
		This function takes no parameters and returns the status of the tunnel as a boolean (this is of limited use).
		Basic usage:
			Scripted: 'cbt.status()'

##### Building Binary From Source:

	Binaries may be found at https://github.com/crossbrowsertesting/cbt-tunnel-nodejs/releases 
	and are compiled using nexe. 

	You may compile from source as follows:

	Requirements:
	node.js/npm
	Python 2.6/2.7
	Visual Studio 2010+ (for Windows)

	- npm install -g nexe
	- git clone https://github.com/crossbrowsertesting/cbt-tunnel-nodejs.git
	- navigate to cloned directory
	- type 'npm install'
	- npm install emitter utf-8-validate bufferutil
	- nexe -f true -i ./cmd_start.js -o OUTPUTBINARYPATH
