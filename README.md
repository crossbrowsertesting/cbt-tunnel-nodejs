##cbt_tunnels.js 

#####A simple program that allows you to test websites that are otherwise inaccessible to our service.

#####Install:
	
	npm install -g cbt_tunnels

There are three options provided for you to do this:

#####simpleproxy:

	This directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.

	Basic usage: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --simpleproxy'

#####webserver:<br>

	This allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local or privileged sites.
	
	Basic usage: 'cbt_tunnels --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR --port OPENPORT'

#####tunnel:<br>
	The tunnel still routes through your computer to download site data, but it further directs that connection through a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).

	Basic usage: 'cbt_tunnels --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'

#####Further flags:<br>
	'--kill KILLFILENAME'
		Appending this flag allows you specify the name of a 'kill file' that if placed in the current directory will cause the program to gracefully shutdown.
	'--v'
		Specifiying this flag enables verbose mode; you'll see most of the traffic handling.
