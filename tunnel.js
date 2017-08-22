var Api = require('./api')



function setupStaticServer(directory){
	let staticServer = require('express')();
	let serveIndex = require('serve-index');
	let serveStatic = require('serve-static');
	staticServer.use('/', serveIndex(directory, {'icons': true, 'hidden': true, 'view': 'details'}));
	staticServer.use('/', serveStatic(directory));
	return staticServer;

}

function startStaticServer(server, port, callback, retry, retryCount){
	// last two arguments need not be provided, they are for when this function calls itself
	if (!port) {
		// if the user didn't supply the port, we want to try multiple ports before giving up
		retry = true;
		port = 8080;
	}
	server.listen(port);
	server.on('error', (err) => {
		if(err.code == 'EADDRINUSE'){
			if (retry == true && retryCount <= 9) {
				// using default ports, try again on the next port...
				startStaticServer(server, port + 1, callback, true, retryCount + 1);
			} else if (retry == false){
				// user specifiede port. If it's not available, just bail.
				let err = new Error(params.port + ' in use. Please choose a different port.');
				warn(err);
				callback(err);
			} else if(retryCount > 9 ){
				// no default ports availalbe
				let err = new Error('Tried serving local directory on ports 8080-8089--all appear to be in use. Please specify a custom port using the --port flag.');
				warn(err);
				callback(err);
			} else {
				// unknown error?
				warn('Error starting webserver.');
				callback(err);
			}
				
		} else {
			// non EADDRINUSE error
			callback(err);
		}
	})
	server.on('listening', () => {
		console.log(`server listening on port ${port}`);
		callback(null, server);
	})
}
	

function Tunnel(username, authkey, params){
	this.params = params || {};
	this.api = new Api(username, authkey, params.test);

	if (params.tunnelType === 'webserver'){
		this.server = setupStaticServer(params.dir);
		startStaticServer(this.server, params.port, (err, server) => {
			if (err){
				console.log("error starting static server: " + err)
			}
			console.log("done starting static server");
		})
	}

	this.startStaticServer = function(attempt){
		this.localServe = require('express')();
		this.serveDir = require('serve-index');
		this.serveStatic = require('serve-static');
		this.directory = params.directory;
		var serverPort = this.serverPort = params.port || 8080+attempt;
		this.localServe.use('/', this.serveDir(this.directory, {'icons': true, 'hidden': true, 'view':'details'}));
		this.localServe.use('/', this.serveStatic(this.directory));

}

t = new Tunnel('johnr@crossbrowsertesting.com', 'ube79d3b777dfcbd', false)

t2 = new Tunnel('johnr@crossbrowsertesting.com', 'supertopsecret', true)
