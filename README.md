##cbt_tunnels.js 

#####A simple program that allows you to test websites that are otherwise inaccessible to our service.

There are three options provided for you to do this:

#####simpleproxy:<br>

	&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This directs requests from CBT browsers to your computer to test sites behind your firewall that would otherwise be inaccessible.<br>

	&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Basic usage:    'node startTunnel.js --username USERNAME --authkey AUTHKEY --simpleproxy'

	<br>&nbsp;&nbsp;&nbsp;&nbsp;#####webserver:

	<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This allows you to host static files on your computer that are not currently hosted on a server, as well as routing through your computer to access local or privileged sites.<br>
	&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Basic usage:    'node tunnel_start.js --authkey AUTHKEY --password PASSWORD --webserver --dir PATH/TO/DIR --port OPENPORT'<br>

	&nbsp;&nbsp;&nbsp;&nbsp;#####tunnel:<br>
	&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;The tunnel still routes through your computer to download site data, but it further directs that connection through a proxy of your choosing (always be wary in choosing a proxy--free and unsecure proxies are known to steal personal data).<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Basic usage:    'node tunnel_start.js --username USERNAME --authkey AUTHKEY --tunnel --proxyIp PROXYIP --proxyPort PROXYPORT'<br><br>&nbsp;&nbsp;&nbsp;&nbsp;#####Further flags:<br>&nbsp;&nbsp;&nbsp;&nbsp;'--kill KILLFILENAME'  <br>&nbsp;&nbsp;&nbsp;&nbsp;Appending this flag allows you specify the name of a 'kill file' that if placed in the current directory will cause the program to gracefully shutdown.<br>&nbsp;&nbsp;&nbsp;&nbsp;'--v'<br>&nbsp;&nbsp;&nbsp;&nbsp;Specifiying this flag enables verbose mode; you'll see most of the traffic handling.
