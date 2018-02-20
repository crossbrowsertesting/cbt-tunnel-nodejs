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
    crypto = require('crypto');

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
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
            logger.info('Server listening on port '+sPort+', serving '+self.directory+'.');
        })
    }

    var tType = self.tType = params.tType;
    self.auth_header = (new Buffer(params.username+':'+params.authkey)).toString('base64');
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
    self.tunnelapi = params.urls.node+'/api/v3/tunnels/'+params.tid;
    var proxyAuthString = self.proxyAuthString = '';
    self.nokill = params.nokill;
    if(!!params.proxyUser && !!params.proxyPass){
        proxyAuthString = self.proxyAuthString = 'Proxy-Authorization: Basic ' + (new Buffer(params.proxyUser + ':' + params.proxyPass)).toString('base64');
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
        var agent = process.env.http_proxy ? new proxyAgent({host:process.env.http_proxy.split(':')[1].replace('//',''),port:process.env.http_proxy.split(':')[2],secureProxy:true}) : new proxyAgent({host:process.env.https_proxy.split(':')[1].replace('//',''),port:process.env.https_proxy.split(':')[2],secureProxy:true});
        conn = self.conn = new WebSocket(self.wsPath,{agent: agent});
    }else{
        conn = self.conn = new WebSocket(self.wsPath,{});
    }
    if(!params.rejectUnauthorized){
        conn.rejectUnauthorized = false;
    }

    var sendLog = self.sendLog = function(log){
        var dataToServer = {
            event:'clientLog',
            client_verbose_log: log
        }
        conn.send(JSON.stringify(dataToServer));
    }

    self.start = function(cb){

        if(proxyAuthString !== ''){
            logger.info('Using basic authentication for proxy server mode.');
            sendLog('Using basic authentication for proxy server mode.');
        }
        var reconnecting = false;
        var reconnectAttempts = 0;

        var ping = setInterval(function(){          
            conn.ping();
        },10000);

        logger.info('Started connection attempt!');
        conn.on('message',function(message){
            try{
                msg = JSON.parse(message);
                self.handleMessage(msg);
            }catch(e){
                warn(e.message);
                warn('Could not parse websocket message:');
                logger.error(util.inspect(message));
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
            logger.error('WebSocket error!');
            cb(e);
        });

        conn.on('open',function(){
            if(params.pac){
                logger.info('Connecting using PAC file.');
            }else{
                logger.info('Connecting as '+self.tType+'.');
            }
            if(!reconnecting){
                cb(null,self);
                sendLog('node tunnel client connected.');
            } else {
                reconnecting = false;
                clearInterval(self.drawTimeout);
            }
            if(!!self.ready){
                logger.info('Setting ready file: '+self.ready);
                fs.open(self.ready,'wx',function(err,fd){
                    if(err){
                        warn('The path specified for the "ready" file already exists or cannot be created (likely for permissions issues).');
                        self.endWrap();   
                    }else{
                        fs.close(fd, function(err){
                            if(err){
                                logger.error(err);
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
                    wsid: wsid
                }
                conn.send(JSON.stringify(dataToServer));
                break;
            case 'versions':
                var checkResult = utils.checkVersion(msg,params);
                sendLog(checkResult);
                if(checkResult.includes('dead')){
                    self.endWrap();
                }
                break;
            case 'check':
                logger.debug('Received check request!');
                sendLog('node client received check request.');
                self.api.checkTunnelIp((err, resp) => {
                    if(err){
                        warn('IP check error!');
                        logger.error(util.inspect(response));
                        warn(err);
                        var data = err;
                        var dataToServer = {
                            event: 'checkrecv',
                            data: data,
                            wsid: wsid
                        }
                        conn.send(JSON.stringify(dataToServer));
                    } else {
                        try{
                            logger.debug('IP appears to CBT as: '+resp.ip);
                            var dataToServer = {
                                event: 'checkrecv',
                                ip: resp.ip,
                                wsid: wsid
                            }
                            conn.send(JSON.stringify(dataToServer));
                        }catch(e){
                            warn('Parsing response failed: '+e);
                            var dataToServer = {
                                event: 'checkrecv',
                                error: e,
                                wsid: wsid
                            }
                            conn.send(JSON.stringify(dataToServer));
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
                logger.error(util.inspect(msg));
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
                logger.debug(id+" client ended by CBT server.");
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
                logger.debug('Creating TCP socket on: \n'+data._type+' '+host+' '+port+' '+id);
                sendLog('Creating TCP socket on: '+data._type+' '+host+' '+port+' '+id);
                connection_list[id].manipulateHeaders = hostInfo.manipulateHeaders;
                connection_list[id].host = data.host;
                connection_list[id].port = data.port;
                connection_list[id].connected = false;
                var client = self.client = connection_list[id].client = net.createConnection({allowHalfOpen:true, port: port, host: host},function(err){
                    if(err){
                        logger.error(err);
                    }
                    connection_list[id].established = true;
                    connection_list[id].ended = false;
                    var dataToServer = {
                        event: 'ack ack ack',
                        id : id,
                        data : null,
                        finished : false,
                        wsid: wsid
                    }
                    conn.send(JSON.stringify(dataToServer));
                    logger.debug('Created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                    sendLog('Created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                });

                client.on('error',function(error){
                    logger.debug('Error on '+id+'!');
                    logger.debug(error.stack);
                    sendLog('Error on TCP socket '+id+'\n'+error.stack);
                    var dataToServer = {
                        event: 'htmlrecv',
                        id : id,
                        data : null,
                        finished : true,
                        wsid: wsid
                    }
                    conn.send(JSON.stringify(dataToServer));
                    connection_list[id].established=false;
                    client.end();
                    connection_list[id].ended=true;
                });

                client.on('data', function(dataRcvd){
                    if(socketExists(id)){
                        logger.debug('TCP socket '+id+' received data: Port:'+port+' Host:'+host);
                        sendLog('TCP socket '+id+' received data: Port:'+port+' Host:'+host);
                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            data : dataRcvd, 
                            finished : true,
                            wsid: wsid
                        }
                        self.isConnected(dataRcvd,id,function(err,connected){
                            if(err){
                                throw err;
                            }else if(!err&&!connected){
                                conn.send(JSON.stringify(dataToServer));
                                logger.debug('TCP socket '+id+' internet data emitted to server.js!');
                                sendLog('TCP socket '+id+' internet data emitted to server.js!');
                            }else if(connected){
                                connection_list[id].connected = true;
                            }
                        }); 
                    }
                });

                client.setTimeout(1000000);

                client.on('timeout',function(data){
                    logger.debug('TCP socket '+id+' session timed out.');
                    sendLog('TCP socket '+id+' session timed out.');
                    var dataToServer = {
                        event: 'htmlrecv',
                        id : id,
                        data : null,
                        finished : true,
                        wsid: wsid
                    }
                    conn.send(JSON.stringify(dataToServer));
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
                        logger.debug(err);
                        logger.debug('TCP socket '+id+' ended by external site.');
                        sendLog('TCP socket '+id+' ended by external site.');
                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            data : null,
                            finished : true,
                            wsid: wsid
                        }
                        conn.send(JSON.stringify(dataToServer));
                        connection_list[id].established=false;
                        client.write('end');
                        client.end();
                        connection_list[id].ended=true;
                    }
                });

                client.on('close', function(err){
                    if(socketExists(id)){
                        logger.debug('TCP socket '+id+' closed by external site.');
                        sendLog('TCP socket '+id+' closed by external site.');
                        if(err&&params.verbose){
                            logger.debug('Error on close of TCP socket: '+id);
                            sendLog('Error on close of TCP socket: '+id);
                        }
                        var dataToServer = {
                            event: 'htmlrecv',
                            id : id,
                            data : null, 
                            finished : true,
                            wsid: wsid
                        }
                        conn.send(JSON.stringify(dataToServer));
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
            if( (data._type === 'bytesonly') && (proxyAuthString !== '') && (data.data.toString().includes('Host')) ){
                data = self.addProxyAuth(data);
            }
            if(connection_list[id].manipulateHeaders){
                data = self.manipulateHeaders(data);
            }
            self.isTLSHello(connection_list[id],data.data,id,function(err){
                if(!err){
                    var bufferToSend = new Buffer(data.data);
                    client.write(bufferToSend, function(err){
                        if(err){
                            logger.debug('Error writing data to: ');
                            logger.debug(util.inspect(client));
                            logger.debug(util.inspect(err));
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
                        logger.debug('Wrote to TCP socket '+id);
                        sendLog('Wrote to TCP socket '+id);
                    });
                }else{
                    logger.debug('TLS error:');
                    logger.debug(util.inspect(err));
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

    self.addProxyAuth = function(data){
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
        if((packet[0]===0x16&&packet[5]===0x01)&&connection_list[id].manipulateHeaders){
            var client = connection.client;
            logger.debug(id+' This is a TLS HELLO! Sending CONNECT...');
            sendLog('Client found TLS hello on: '+id);
            var bufferToSend = Buffer.from(self.buildConnect(connection.host+':'+connection.port));
            client.write(bufferToSend, function(err){
                if(err&&params.verbose){
                    logger.debug('Error writing data to: ');
                    logger.debug(util.inspect(client));
                    logger.debug(util.inspect(err));
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
                logger.debug('Wrote to TCP socket '+id);
                sendLog('Wrote to TCP socket '+id);
                var connectedInterval = setInterval(function(){
                    if(connection_list[id].connected){
                        if(params.verbose){
                            logger.debug(id+' Received connection established!');
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
                logger.error(err);
                return cb(err);
            } else {
                return cb(null, 'killit');
            }
        });

        if(self.ready){
            fs.unlink(self.ready, function(err){
                if(err){
                    logger.error(err);
                    setTimeout(function(){
                        process.exit(1);
                    },10000);
                } 
            })
        }
    }

    self.endWrap = function(){
        self.end(function(err, killit){
            if(!err && killit === 'killit'){
                logger.info('Local connection disconnected.');
                if(!self.nokill){
                    logger.info('Bye!');
                    process.exit(0);
                }
            }else if(err){
                logger.error(err);
                setTimeout(function(){
                    process.exit(1);
                }, 10000);
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
}

module.exports = cbtSocket;