/**
 * @file
 * @copyright (c) 2013 Stephan Brenner
 * @license   This project is released under the MIT License.
 *
 * This file implements a Node.js module for initiating socket.io connections
 * through a proxy server.
 */

(function(){
    var http = require('http');
    var https = require('https');
    var url = require('url');
    var io = require('socket.io-client');
	var HttpsProxyAgent = require('https-proxy-agent');

    // port range, chosen from http://stackoverflow.com/a/28369841
    var tunnelPort = getRandomInt(43124, 44320);
    var tunnelServer;
    var initialized = false;

    /**
     * Returns a random integer between min (inclusive) and max (inclusive)
     * Using Math.round() will give you a non-uniform distribution!
     * ( From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random )
     */
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    exports.connect = function(destinationUrl, options) {
        var destination = url.parse(destinationUrl);
        if (!destination.port) {
            destination.port = destination.protocol === 'https:' ? 443 : 80;
        }

        var pathname = destination.pathname || '/';

        if (!initialized) exports.init();

        if (typeof tunnelServer === 'undefined') return io.connect(destinationUrl, options);   // Direct connection

        options = options || {};
        options['force new connection'] = true;   // Allows one tunnel server to handle multiple destinations

        return io.connect('http://localhost:' + tunnelPort + pathname +
            '?protocol=' + destination.protocol.replace(':', '')  +
            '&hostname=' + destination.hostname +
            '&port=' + destination.port +
            '&' + options.query, options);
    };

    exports.init = function(proxyUrl) {
        initialized = true;

        if (typeof tunnelServer !== 'undefined') {
            tunnelServer.close();
            tunnelServer = undefined;
        }

        if (typeof proxyUrl === 'undefined') {
            if (process.env.http_proxy) {
                proxyUrl = process.env.http_proxy;
            }else if(process.env.https_proxy){
                proxyUrl = process.env.https_proxy;
            } else {
                console.log('Direct connection (no proxy defined)');
                return;
            }
        }

		var agent = new HttpsProxyAgent(proxyUrl);

        tunnelServer = http.createServer(function (request, response) {
            var requestUrl = url.parse(request.url, true);
            var hostname = requestUrl.query.hostname;
            var port = requestUrl.query.port;
            var qs = [];
            
            for (var i in requestUrl.query){
                if (['protocol','hostname','port'].indexOf(i) == -1){
                    qs.push( i + '=' + requestUrl.query[i] );
                }
            }

            qs = '?'+qs.join('&');

            var options = {
                hostname: hostname,
                port: port,
                path: requestUrl.pathname + qs,
                method: request.method,
                headers: request.headers,
				agent: agent
            };

            var proxy_request = requestUrl.query.protocol === 'http'
                ? http.request(options)
                : https.request(options);

            proxy_request.addListener('response', function (proxy_response) {
                proxy_response.addListener('data', function (chunk) { response.write(chunk, 'binary'); });
                proxy_response.addListener('end', function () { response.end(); });
                response.writeHead(proxy_response.statusCode, proxy_response.headers);
            });

            proxy_request.on('error', function(err) {
               console.log('Error: found error in socket.io-proxy - error is: ' + err);
               console.log(err.stack);
            });

            request.addListener('data', function (chunk) { proxy_request.write(chunk, 'binary'); });
            request.addListener('end', function () { proxy_request.end(); });
        });

        tunnelServer.listen(tunnelPort);
        console.log('Proxy: ' + proxyUrl);
    };
})();
