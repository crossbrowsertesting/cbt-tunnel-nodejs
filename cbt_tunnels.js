var net = require('net'),
    util = require('util'),
    tls = require('tls'),
    fs  = require('fs'),
    connection_list = {},
    _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    utils  = require('./utils.js'),
    WebSocket = require('ws'),
    proxyAgent = require('https-proxy-agent'),
    os = require('os'),
    crypto = require('crypto'),
    version = require('./package.json').version;

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function padHeaderLength(lengthNumber) {
    while (lengthNumber.length < 4) {
        lengthNumber = '0' + lengthNumber;
    }

    return lengthNumber;
}

// takes an header object and packs it alongside binary blob
function packData(obj, dataReceived) {
    var binaryObject = Buffer.from(JSON.stringify(obj));
    var paddedLength = padHeaderLength(String(binaryObject.byteLength));
    var objectLength = Buffer.from(paddedLength);
    if (!dataReceived) {
        return Buffer.concat([objectLength, binaryObject]);
    }

    return Buffer.concat([objectLength, binaryObject, dataReceived]);
}

function unpackData(binaryData) {
    // look at first three bytes to get the length of the header
    var length = binaryData.slice(0,4);
    length = parseInt(length);
    var headerData = binaryData.slice(4, length+4);

    headerData = JSON.parse(headerData);
    if (length + 4 == binaryData.byteLength){
        headerData.data = null;
    } else {
           headerData.data = binaryData.slice(length+4, binaryData.byteLength);
    }
    return headerData;
}

function cbtSocket(api, params) {
    var inbound;
    var outbound;
    var self = this;

    var killLever = utils.killLever(self);
    params.context = self;

    self.tunnelId = params.tid;
    self.api = api;

    function getInbound(){
        return inbound;
    }

    function getOutbound(){
        return outbound;
    }

    self.startStaticServer = function(attempt){
        if (!attempt){ attempt = 0 };
        self.localServe = require('express')();
        self.serveDir = require('serve-index');
        self.serveStatic = require('serve-static');
        self.directory = params.directory;
        var sPort = self.sPort = params.port || 8080+attempt;
        self.localServe.use('/', self.serveDir(self.directory, {'icons': true, 'hidden': true, 'view':'details'}));
        self.localServe.use('/', self.serveStatic(self.directory));
        self.server = self.localServe.listen(sPort);
        self.server.on('error',function(err){
            if(err.code == 'EADDRINUSE' && attempt<9 && (!params.port)){
                warn('Port '+(8080+attempt)+' in use');
                self.startStaticServer(attempt+1);
            }else if(attempt>=9){
                warn('Tried serving local directory on ports 8080-8089--all appear to be in use. Please specify a custom port using the --port flag.');
                self.endWrap();
            }else if(params.port){
                warn(params.port+' in use. Please choose a different port.');
                self.endWrap();
            }else{
                warn('Error starting webserver.');
                self.endWrap();
            }
        });
        self.server.on('listening',function(){
            global.logger.info('Server listening on port '+sPort+', serving '+self.directory+'.');
        })
    }

    var tType = self.tType = params.tType;
    self.auth_header = (Buffer.from(params.username+':'+params.authkey)).toString('base64');

    // not used elsewhere
    self.t = params.t;
    self.userId = params.userId;
    self.authkey = params.authkey;
    self.qPort = (params.bytecode ? pad((params.tcpPort-11000),3) : pad((params.tcpPort-11000), 3));
    self.wsPort = params.tcpPort+1000;

    self.cbtServer = 'https://'+params.cbtServer;
    self.cbtApp = 'https://'+params.urls.node;
    self.path = '/wsstunnel' + self.qPort + '/socket.io';
    self.query = 'userid=' + self.userId + '&authkey=' + self.authkey;

    self.wsPath = self.cbtServer+self.path+'?'+self.query;

    if (global.isLocal) {
        self.wsPath = params.wssUrl;
        global.logger.info(`change wsPath to ${self.path}`);
    }

    self.tunnelapi = params.urls.node+'/api/v3/tunnels/'+params.tid;
    var proxyAuthString = self.proxyAuthString = '';
    self.nokill = params.nokill;
    if(!!params.proxyUser && !!params.proxyPass){
        proxyAuthString = self.proxyAuthString = 'Proxy-Authorization: Basic ' + (Buffer.from(params.proxyUser + ':' + params.proxyPass)).toString('base64');
    }
    self.ready = params.ready;

    switch(tType){
        case 'simple':
            break;
        case 'webserver':
            self.startStaticServer();
            break;
        case 'tunnel':
            var tType = self.tType = 'tunnel';
            var port = self.proxyPort = params.proxyPort;
            var host = self.proxyHost = params.proxyIp;
            break;
        default:
    }
    var conn = self.conn = null;

    if (process.env.http_proxy || process.env.https_proxy){
        var agent = makeProxyAgent();
        conn = self.conn = new WebSocket(self.wsPath,{agent: agent});
    }else{
        conn = self.conn = new WebSocket(self.wsPath,{ perMessageDeflate: false });
    }
    self.conn.bufferType = "arraybuffer";
    if(!params.rejectUnauthorized){
        conn.rejectUnauthorized = false;
    }

    var sendLog = self.sendLog = function(log){
        var dataToServer = {
            event:'clientLog',
            client_verbose_log: log
        }
        var payload = packData(dataToServer, Buffer.from([]))
        conn.send(payload);
    }

    self.start = function(cb){

        if(proxyAuthString !== ''){
            global.logger.debug('Using basic authentication for proxy server mode.');
            // sendLog('Using basic authentication for proxy server mode.');
        }
        var reconnecting = false;
        var reconnectAttempts = 0;

        var ping = setInterval(function(){          
            conn.ping();
        },10000);

        global.logger.debug('Started connection attempt!');
        conn.on('message',function(message){
            try{
                /*
                    the first hello we get will be a string,
                    we'll respond with a buffer, and from that
                    point forward, we'll be talking buffers.
                 */
                if (_.isString(message)) {
                    global.logger.debug("Incoming message is string");
                    msg = JSON.parse(message);
                } else {
                    msg = unpackData(message)
                }
                self.handleMessage(msg);
            }catch(e){
                warn(e.message);
                warn('Could not parse websocket message:');
                global.logger.error(util.inspect(message));
            }
        })

        conn.on('close',function(data){
            reconnecting = true;
            clearInterval(ping);
            if(!params.verbose&&!params.quiet && params.cmd){
                clearInterval(self.drawTimeout);
                self.spin(null,'Disconnected from CBT server.\n');
            }else{
                warn('Disconnected from CBT server.\n');
            }
            connection_list = {};
        });

        conn.on('error',function(e){
            global.logger.error('WebSocket error!');
            cb(e);
        });

        conn.on('open',function(){
            if(params.pac){
                global.logger.info('Connecting using PAC file.');
            }else{
                global.logger.info('Connecting as '+self.tType+'.');
            }
            if(!reconnecting){
                cb(null,self);
                sendLog('node tunnel client connected.');
            } else {
                reconnecting = false;
                clearInterval(self.drawTimeout);
            }
            if(!!self.ready){
                global.logger.info('Setting ready file: '+self.ready);
                fs.open(self.ready,'wx',function(err,fd){
                    if(err){
                        warn('The path specified for the "ready" file already exists or cannot be created (likely for permissions issues).');
                        self.endWrap();   
                    }else{
                        fs.close(fd, function(err){
                            if(err){
                                global.logger.error(err);
                                self.endWrap();
                            }
                            sendLog('ready file written: '+self.ready);
                        });
                    }
                });
            }
        });
    }

    self.handleMessage = function(msg){
        var data = null,
            id = null;
        if(!!msg.data){
            data = msg.data;
            id = data.id;
        }
        var wsid = msg.wsid;

        switch(msg.event){
            case 'hello':
                var dataToServer = {
                    event: 'established',
                    wsid: wsid,
                }
                // versions of cbt_tunnels > 1.0.0 send their version to server.js on hello. - CC
                var payload = packData(dataToServer, Buffer.from(version));
                conn.send(payload);
                break;
            case 'versions':
                var checkResult = utils.checkVersion(msg,params);
                sendLog(checkResult);
                if(checkResult.includes('dead')){
                    self.endWrap();
                }
                break;
            case 'check':
                global.logger.debug('Received check request!');
                sendLog('node client received check request.');
                self.api.checkTunnelIp((err, resp) => {
                    if(err){
                        warn('IP check error!');
                        global.logger.error(util.inspect(response));
                        warn(err);
                        var data = err;
                        var dataToServer = {
                            event: 'checkrecv',
                            wsid: wsid
                        }
                        var payload = packData(dataToServer, data)
                        conn.send(payload);
                    } else {
                        try{
                            global.logger.debug('IP appears to CBT as: '+resp.ip);
                            var dataToServer = {
                                event: 'checkrecv',
                                ip: resp.ip,
                                wsid: wsid
                            }
                            var payload = packData(dataToServer, Buffer.from([]))
                            conn.send(payload);
                        }catch(e){
                            warn('Parsing response failed: '+e);
                            var dataToServer = {
                                event: 'checkrecv',
                                error: e,
                                wsid: wsid
                            }
                            var payload = packData(dataToServer, Buffer.from([]))
                            conn.send(payload);
                        }
                    }
                });
                break;
            case 'legitdead':
                warn('User requested ending this tunnel.');
                sendLog('User requested ending this tunnel via UI. Theoretically. Server.js got a SIGINT.');
                self.endWrap();
                break;
            case 'data':
                self.handleData(msg);
                break;
            default:
                warn('Unknown message type:');
                global.logger.error(util.inspect(msg));
                throw new Error('Unknown message type: '+msg);
        }
    }

    self.handleData = function(msg){
        var data = msg;

        var id = msg.id;
        var wsid = msg.wsid;

        if (!connection_list[id]) {
            connection_list[id] = { id : data.id , client : null };
            connection_list[id].established = false;
        }

        if(socketExists(id) && data._type === 'end'){
            if(connection_list[data.id].client){
                global.logger.debug(id+" client ended by CBT server.");
                sendLog(''+id+' tcp client ended by CBT server.');
                connection_list[id].established=false;
                connection_list[id].client.end();
                connection_list[id].client.destroy();
                connection_list[id].ended=true;
            }
            return;
        }

        if( (data._type != 'end') && (!connection_list[id].established) && (!connection_list[id].ended) ){
            inbound += 1;
            utils.determineHost({host:data.host,port:data.port,proxyHost:self.proxyHost,proxyPort:self.proxyPort,tType:self.tType},params,function(err,hostInfo){
                if(err){
                    sendLog(err);
                    warn(err);
                }
                var host = self.host = hostInfo.host;
                var port = self.port = hostInfo.port;
                if(host === 'local' && self.tType === 'webserver'){
                    host = 'localhost';
                    port = self.sPort;
                }else if(host === 'local'){
                    host = 'localhost';
                }
                global.logger.debug('Creating TCP socket on: \n'+data._type+' '+host+' '+port+' '+id);
                sendLog('Creating TCP socket on: '+data._type+' '+host+' '+port+' '+id);
                connection_list[id].manipulateHeaders = hostInfo.manipulateHeaders;
                connection_list[id].host = data.host;
                connection_list[id].port = data.port;
                connection_list[id].connected = false;
                var client = self.client = connection_list[id].client = net.createConnection({allowHalfOpen:true, port: port, host: host},function(err){
                    if(err){
                        global.logger.error(err);
                    }
                    connection_list[id].established = true;
                    connection_list[id].ended = false;
                    var dataToServer = {
                        event: 'ack ack ack',
                        id : id,
                        finished : false,
                        wsid: wsid
                    }
                    var payload = packData(dataToServer, Buffer.from([]))
                    conn.send(payload);
                    global.logger.debug('Created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                    sendLog('Created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                });

                client.on('error',function(error){
                    global.logger.debug('Error on '+id+'!');
                    global.logger.debug(error.stack);
                    sendLog('Error on TCP socket '+id+'\n'+error.stack);
                    var dataToServer = {
                        event: 'htmlrecv',
                        id : id,
                        finished : true,
                        wsid: wsid
                    }
                    var payload = packData(dataToServer, Buffer.from([]))
                    conn.send(payload); 
                    connection_list[id].established=false;
                    client.end();
                    connection_list[id].ended=true;
                });

                client.on('data', function(dataRcvd){
                    if(socketExists(id)){
                        global.logger.debug('TCP socket '+id+' received data: Port:'+port+' Host:'+host);

                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            finished : false,
                            wsid: wsid
                        }

                        var payload = packData(dataToServer, dataRcvd)

                        self.isConnected(dataRcvd,id,function(err,connected){
                            if(err){
                                throw err;
                            }else if(!err&&!connected){
                                conn.send(payload);
                                global.logger.debug('TCP socket '+id+' internet data emitted to server.js!');
                            }else if(connected){
                                connection_list[id].connected = true;
                            }
                        }); 
                    }
                });

                client.setTimeout(1000000);

                client.on('timeout',function(data){
                    global.logger.debug('TCP socket '+id+' session timed out.');
                    sendLog('TCP socket '+id+' session timed out.');
                    var dataToServer = {
                        event: 'htmlrecv',
                        id : id,
                        finished : true,
                        wsid: wsid
                    }
                    var payload = packData(dataToServer, Buffer.from([]))
                    conn.send(payload);
                    client.write('end');
                    client.end();
                    client.destroy();
                    if(connection_list[id]){
                        connection_list[id].established=false;
                        connection_list[id].ended=true;
                    }
                });

                client.on('end', function(data,err){
                    if(socketExists(id)){
                        global.logger.debug(err);
                        global.logger.debug('TCP socket '+id+' ended by external site.');
                        sendLog('TCP socket '+id+' ended by external site.');
                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            finished : true,
                            wsid: wsid
                        }
                        var payload = packData(dataToServer, Buffer.from([]))
                        conn.send(payload);
                        connection_list[id].established=false;
                        client.write('end');
                        client.end();
                        connection_list[id].ended=true;
                    }
                });

                client.on('close', function(err){
                    if(socketExists(id)){
                        global.logger.debug('TCP socket '+id+' closed by external site.');
                        sendLog('TCP socket '+id+' closed by external site.');
                        if(err&&params.verbose){
                            global.logger.debug('Error on close of TCP socket: '+id);
                            sendLog('Error on close of TCP socket: '+id);
                        }
                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            finished : true,
                            wsid: wsid
                        }
                        var payload = packData(dataToServer, Buffer.from([]))
                        conn.send(payload);
                        connection_list[id].established=false;
                        client.write('end');
                        client.end();
                        connection_list[id].ended=true;
                    }
                });
            });
        }

        if((socketExists(id)&&data.data)||(data._type==='bytesonly')){
            var client = connection_list[id].client;
            var receivedDataString = Buffer.from(data.data).toString();

            if( (data._type === 'bytesonly') && (proxyAuthString !== '') && (receivedDataString.includes('Host')) ){
                data = self.addProxyAuth(data, receivedDataString);
            }
            if(connection_list[id].manipulateHeaders){
                data = self.manipulateHeaders(data);
            }
            self.isTLSHello(connection_list[id],data.data,id,function(err){
                if(!err){
                    var bufferToSend = Buffer.from(data.data.toJSON());
                    client.write(bufferToSend, function(err){
                        if(err){
                            sendLog('Error writing data to: '+util.inspect(client)+' '+util.inspect(err));
                            var dataToServer = {
                                event: 'htmlrecv',
                                id : id, 
                                data : null, 
                                finished : true,
                                wsid: wsid
                            }
                            connection_list[id].established=false;
                            client.end();
                            client.destroy();
                            connection_list[id].ended=true;
                        }
                        outbound+=1;
                        global.logger.debug('Wrote to TCP socket '+id);
                    });
                }else{
                    global.logger.debug('TLS error:');
                    global.logger.debug(util.inspect(err));
                    throw err;
                }
            });
        }
    }

    self.spin = function(old,msg){
        inbound = 0;
        outbound = 0;
        gfx.draw(getInbound(), getOutbound(), old, msg, self.tType);
        self.drawTimeout = setInterval(function(){
            gfx.draw(getInbound(), getOutbound(), old, msg, self.tType);
            inbound = 0;
            outbound = 0;
        }, 1000);
        process.stdout.on('resize', function() {
            clearInterval(self.drawTimeout);
            gfx.draw(getInbound(), getOutbound(), old, msg, self.tType);
            self.drawTimeout = setInterval(function(){
                gfx.draw(getInbound(), getOutbound(), old, msg, self.tType);
                inbound = 0;
                outbound = 0;
            }, 1000);
        });
    }

    self.addProxyAuth = function(data, dataStr){
        dataArr = dataStr.split('\r\n');
        dataArr = _.filter(dataArr, function(col){
            if(!col==''){
                return col
            }
        });
        dataArr.push(proxyAuthString);
        dataStr = dataArr.join('\r\n');
        dataStr+='\r\n\r\n';
        data.data = Buffer.from(dataStr,'ascii');
        return data;
    }

    self.manipulateHeaders = function(data){
        var dataArr = [];
        data.data.map((char)=>{
            dataArr.push(String.fromCharCode(char));
        })
        dataStr = dataArr.join('');
        dataArr = dataStr.split('\r\n');
        dataArr = _.filter(dataArr, function(col){
            if(!col==''){
                return col
            }
        });
        var method = dataArr[0].includes('GET') ? 'GET' : (dataArr[0].includes('POST') ? 'POST' : (dataArr[0].includes('PUT') ? 'PUT' : (dataArr[0].includes('DELETE') ? 'DELETE' : (dataArr[0].includes('OPTIONS') ? 'OPTIONS' : null))));
        if(method){
            var host = dataArr.find((element)=>{
                return (element.includes('host:')||element.includes('Host:')||element.includes('HOST:'))
            });
            host = host.split('Host:')[1].replace(' ','');
            host = !(host.includes('http://')&&host.includes('https://')) ? 'http://'+host : host;
            dataArr[0] = dataArr[0].replace(method+' ','GET '+host);
            dataStr = dataArr.join('\r\n');
            dataStr+='\r\n\r\n';
            data.data = Buffer.from(dataStr,'ascii');
            return data;
        }
        return data
    }

    self.buildConnect = function(destination){
        var connect = "CONNECT "+destination+" HTTP/1.1\r\nhost: "+destination+"\r\nConnection: close\r\n\r\n";
        return connect;
    }

    self.isConnected = function(packet,id,cb){
        if(connection_list[id].manipulateHeaders){
            var dataArr = [];
            packet.map((char)=>{
                dataArr.push(String.fromCharCode(char));
            });
            dataStr = dataArr.join('');
            if(dataStr.includes('Connection established')){
                cb(null,true);
            }else{
                cb(null,false);
            }
        }else{
            cb(null,false);
        }
    }

    self.isTLSHello = function(connection,packet,id,cb){
        //&&(packet[4]===0x7C||packet[4]===0x7C)
        if((packet[0]===22&&packet[5]===191 && connection_list[id].manipulateHeaders)){
            var client = connection.client;
            global.logger.debug(id+' This is a TLS HELLO! Sending CONNECT...');
            sendLog('Client found TLS hello on: '+id);
            var bufferToSend = Buffer.from(self.buildConnect(connection.host+':'+connection.port));
            client.write(bufferToSend, function(err){
                if(err&&params.verbose){
                    global.logger.debug('Error writing data to: ');
                    global.logger.debug(util.inspect(client));
                    global.logger.debug(util.inspect(err));
                    sendLog('Error writing data to: '+util.inspect(client)+' '+util.inspect(err));
                    var dataToServer = {
                        event: 'htmlrecv',
                        id : id, 
                        data : null, 
                        finished : true,
                        wsid: wsid
                    }
                    connection_list[id].established=false;
                    client.end();
                    client.destroy();
                    connection_list[id].ended=true;
                    cb(err);
                }
                outbound+=1;
                global.logger.debug('Wrote to TCP socket '+id);
                var connectedInterval = setInterval(function(){
                    if(connection_list[id].connected){
                        if(params.verbose){
                            global.logger.debug(id+' Received connection established!');
                        }
                        clearInterval(connectedInterval);
                        connection_list[id].connected = false;
                        cb(null);
                    }
                },1);
            });
        }else{
            cb(null);   
        }

    }

    self.end = function(cb){
        clearInterval(self.drawTimeout);
        clearInterval(self.ping);

        self.api.deleteTunnel(self.tunnelId, (err, deleteResp) => {
            if (!!self.server){
                self.server.close();
            };
            for(connection in connection_list){
                if(socketExists(connection.id)){
                    connection.client.end();
                }
            };
            if (err){
                global.logger.error(err);
                return cb(err);
            } else {
                return cb(null, 'killit');
            }
        });

        if(self.ready){
            fs.unlink(self.ready, function(err){
                if(err){
                    global.logger.error(err);
                    if (!self.nokill){
                        setTimeout(function(){
                            process.exit(1);
                        },10000);
                    }
                } 
            })
        }
    }

    self.endWrap = function(cb){
        self.end(function(err, killit){
            if(!err && killit === 'killit'){
                global.logger.info('Local connection disconnected.');
                if(cb) cb(null,true)
                if(!self.nokill){
                    global.logger.info('Bye!');
                    process.exit(0);
                }
                if(cb) cb(null,true)
            }else if(err){
                global.logger.error(err);
                if(cb) cb(err,false)
                if(!self.nokill){
                    setTimeout(function(){
                        process.exit(1);
                    }, 10000);
                }
            }
        });
    }

    function socketExists(id){
        return (
            (!!connection_list[id])              // connection list has property `id`
            && (!!connection_list[id].client)    // id has property client
            && (!connection_list[id].ended)      // id property ended is false
            && (connection_list[id].established) // id property established is true
            && (Object.getOwnPropertyNames(connection_list[id].client.address()).length > 0)
        )
    }

    function makeProxyAgent(){
        var pString = process.env.http_proxy || process.env.https_proxy;
        pString = pString.replace('http://','');
        var agentAuth;
        if(pString.includes('@')){
            agentAuth = pString.slice(0,pString.indexOf('@'));
        }
        var agentHost = pString.slice(pString.indexOf('@')+1,pString.lastIndexOf(':'));
        var agentPort = pString.slice(pString.lastIndexOf(':')+1);
        var agent = new proxyAgent({host:agentHost,port:agentPort,auth:agentAuth,secureProxy:true});
        return agent;
    }
}

module.exports = cbtSocket;
