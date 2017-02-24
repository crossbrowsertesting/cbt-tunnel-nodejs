var net = require('net'),
    util = require('util'),
    tls = require('tls'),
    fs  = require('fs'),
    connection_list = {},
    request = require('request'),
    _ = require('lodash'),
    gfx = require('./gfx.js'),
    warn = gfx.warn,
    utils  = require('./utils.js');

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function cbtSocket(params) {
    var inbound,
        outbound,
        self = this;
        params.context = self,
        killLever = utils.killLever(self);

    function getInbound(){
        return inbound;
    }

    function getOutbound(){
        return outbound;
    }

    self.startStaticServer = function(attempt){
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
            console.log('Server listening on port '+sPort);
        })
    }

    var tType = self.tType = params.tType;
    self.auth_header = (new Buffer(params.username+':'+params.authkey)).toString('base64');
    self.t = params.t;
    self.userId = params.userId;
    self.authkey = params.authkey;
    self.qPort = (params.bytecode ? pad((params.tcpPort-11000),3) : pad((params.tcpPort-11000), 3));
    self.wsPort = params.tcpPort+1000;
    self.cbtServer = 'https://' + params.cbtServer;
    self.cbtApp = 'https://'+params.urls.node;
    self.path = '/wsstunnel' + self.qPort + '/socket.io';
    self.query = 'userid=' + self.userId + '&authkey=' + self.authkey;
    self.tunnelapi = params.urls.node+'/api/v3/tunnels/'+params.tid;
    var proxyAuthString = self.proxyAuthString = '';
    if(!_.isUndefined(params.proxyUser)&&!_.isUndefined(params.proxyPass)){
        proxyAuthString = self.proxyAuthString = 'Proxy-Authorization: Basic '+(new Buffer(params.proxyUser+':'+params.proxyPass)).toString('base64');
    }
    self.ready = params.ready;
    switch(tType){
        case 'simple':
        break;
        case 'webserver':
            self.startStaticServer(0);
        break;
        case 'tunnel':
            var tType = self.tType = 'tunnel';
            var port = self.proxyPort = params.proxyPort;
            var host = self.proxyHost = params.proxyIp;
        break;
        default:
    }

    var conn = self.conn = null;

    if(process.env.http_proxy||process.env.https_proxy){
        process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;
        conn = self.conn = require('./lib/socket.io-proxy').connect(self.cbtServer,{path: self.path, query: self.query, reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000, secure:false});
    }else{
        conn = self.conn = require('socket.io-client')(self.cbtServer,{path: self.path, query: self.query, reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000, secure:false});
    }

    var sendLog = self.sendLog = function(log){
        conn.emit('clientLog','client_verbose_log: '+log);
    }

    self.start = function(cb){
        if(proxyAuthString!==''&&params.verbose){
            console.log('Using basic authentication for proxy server mode.');
            sendLog('Using basic authentication for proxy server mode.');
        }
        var reconnecting = false;
        var reconnectAttempts = 0;

        var ping = setInterval(function(){
            //socket.io is bad people            
            conn.emit('pingcheck');
        },10000);

        console.log('Started connection attempt!');

        conn.on('reconnect_error',function(e){
            if(params.verbose){
                warn('Reconnect error:');
                warn(e);
            }
            reconnectAttempts++;
            if(reconnectAttempts>=5){
                warn('Could not reconnect to CBT server.');
                self.endWrap();
            }
        });

        conn.on('connect_error',function(e){
            if(params.verbose){
                warn('Connection error:');
                warn(e);
            }
            warn('Could not connect to CBT server.');
        });

        conn.on('connect',function(){
            console.log('Connecting as '+self.tType+'...');
            if(!reconnecting){
                cb(null,self);
                sendLog('node tunnel client connected.');
            }else{
                reconnecting = false;
                clearInterval(self.drawTimeout);
            }
            if(!_.isUndefined(self.ready)&&!_.isNull(self.ready)){
                fs.open(self.ready,'wx',function(err,fd){
                    if(err){
                        warn('The path specified for the "ready" file already exists or cannot be created (likely for permissions issues).');
                        self.endWrap();   
                    }else{
                        fs.close(fd, function(err){
                            if(err){
                                console.log(err);
                                self.endWrap();
                            }
                            sendLog('ready file written: '+self.ready);
                        });
                    }
                });
            }
        });

        conn.on('reconnect',function(){
            warn('Reconnected!');
            ping = setInterval(function(){
                //socket.io is bad people            
                conn.emit('pingcheck');
            },10000);
            sendLog('reconnected to server.js after '+reconnectAttempts+' attempts.');
        });

        conn.on("error", function(e){
            console.log('Socket.io error!');
            cb(e);
        });

        conn.on("disconnect", function(data){
            reconnecting = true;
            clearInterval(ping);
            if(!params.verbose){
                clearInterval(self.drawTimeout);
                self.spin(null,'Disconnected from CBT server.\n');
            }else{
                warn('Disconnected from CBT server.\n');
            }
            connection_list = {};
        });

        conn.on("hello", function() {
            conn.emit('established');
        });

        conn.on('progress',function(data){
            console.log('progress\n');
            console.log(data);
        });

        conn.on('versions',function(data){
            var checkResult = utils.checkVersion(data,params);
            sendLog(checkResult);
            if(checkResult.includes('dead')){
                self.endWrap();
            }
        });

        conn.on('check',function(){
            if(params.verbose){
                console.log('Received check request!');
                sendLog('node client received check request.');
            }
            request.get(self.cbtApp+'/api/v3/tunnels/checkIp',function(err,response,body){
                if(err||response.statusCode!==200){
                    if(params.verbose){
                        warn('IP check error!');
                        console.dir(response);
                        warn(err);
                        var data = err ? {error:err} : {error:response.statusCode};
                        conn.emit('checkrecv',data);
                    }
                }else{
                    if(params.verbose){
                        try{
                            var body = JSON.parse(body);
                            console.log('IP appears to CBT as: '+body.ip);
                            conn.emit('checkrecv',{ip:body.ip});
                        }catch(e){
                            warn('Parsing response failed: '+e);
                            conn.emit('checkrecv',{error:e});
                        }
                    }
                }
            })
        })

        conn.on('legitdead',function(){
            warn('User requested ending this tunnel.');
            sendLog('user requested ending this tunnel via UI.');
            self.endWrap();
        });

        conn.on('data', function(data,fn){
            var id = data.id;
            if (!connection_list[id]) {
                connection_list[id] = { id : data.id , client : null };
                connection_list[id].established=false;
            }
            if(socketExists(id) && data._type === 'end'){
                if(connection_list[data.id].client){
                    if(params.verbose){
                        console.log(id+" client ended by CBT server.");
                        sendLog(''+id+' tcp client ended by CBT server.');
                        console.log(data);
                    }
                    connection_list[id].established=false;
                    connection_list[id].client.end();
                    connection_list[id].client.destroy();
                    connection_list[id].ended=true;
                }
                return;
            }

            if(connection_list[id].established){
                var client = connection_list[id].client;
            }

            if((data._type!='end')&&(!connection_list[id].established)&&(!connection_list[id].ended)){
                inbound += 1;
                var port = self.port = ( self.tType==='tunnel' ? self.proxyPort : data.port );
                var host = self.host = ( self.tType==='tunnel' ? self.proxyHost : data.host );

                if(host==='local'&&self.tType==='webserver'){
                    host='localhost';
                    port = self.sPort;
                }else if(host==='local'){
                    host='localhost';
                }
                if(params.verbose){
                    console.log('Creating TCP socket on: \n'+data._type+' '+host+' '+port+' '+id);
                    sendLog('creating TCP socket on: '+data._type+' '+host+' '+port+' '+id);
                }
                var client = self.client = connection_list[id].client = net.createConnection({port: port, host: host},function(err){
                    if(err){
                        console.log(err);
                    }
                    connection_list[id].established = true;
                    connection_list[id].ended = false;
                    if(fn){
                        fn('ack ack ack');
                    }
                    if(params.verbose){
                        console.log('Created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                        sendLog('created TCP socket: '+data._type+' '+host+' '+port+' '+id);
                    }
                });
            
                client.on('error',function(error){
                    if(params.verbose){
                        console.log('Error on '+id+'!');
                        console.log(error.stack);
                        sendLog('Error on TCP socket '+id+'\n'+error.stack);
                    }
                    conn.emit("htmlrecv", 
                        { id : id, data : null, finished : true }
                    );
                    connection_list[id].established=false;
                    client.end();
                    connection_list[id].ended=true;
                });

                client.on('data', function(dataRcvd){
                    if(socketExists(id)){
                        if(params.verbose){
                            console.log('TCP socket '+id+' received data: Port:'+port+' Host:'+host);
                            sendLog('TCP socket '+id+' received data: Port:'+port+' Host:'+host);
                        }
                        conn.emit("htmlrecv",
                            { id : id, data : dataRcvd, finished : false }
                        );
                        if(params.verbose){
                            console.log('TCP socket '+id+' internet data emitted to server.js!');
                            sendLog('TCP socket '+id+' internet data emitted to server.js!');
                        }   
                    }
                });

                client.setTimeout(1000000);

                client.on('timeout',function(data){
                    if(params.verbose){
                        console.log('TCP socket '+id+' session timed out.');
                        sendLog('TCP socket '+id+' session timed out.');
                    }
                    conn.emit("htmlrecv", 
                        { id : id, data : null, finished : true }
                    );
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
                        if(params.verbose){
                            console.log(err);
                            console.log('TCP socket '+id+' ended by external site.');
                            sendLog('TCP socket '+id+' ended by external site.');
                        }
                        conn.emit('htmlrecv', 
                            { id : id, data : data, finished : true }
                        );
                        connection_list[id].established=false;
                        client.write('end');
                        client.end();
                        connection_list[id].ended=true;
                    }
                });

                client.on('close', function(err){
                    if(socketExists(id)){
                        if(params.verbose){
                            console.log('TCP socket '+id+' closed by external site.');
                            sendLog('TCP socket '+id+' closed by external site.');
                        }
                        if(err&&params.verbose){
                            console.log('Error on close of TCP socket: '+id);
                            sendLog('Error on close of TCP socket: '+id);
                        }
                        conn.emit('htmlrecv', 
                            { id : id, data : null, finished : true }
                        );
                        connection_list[id].established=false;
                        client.write('end');
                        client.end();
                        connection_list[id].ended=true;
                    }
                });
            }
            if((socketExists(id)&&data.data)||(data._type==='bytesonly')){
                client = connection_list[id].client;
                if(data._type==='bytesonly'&&proxyAuthString!==''&&data.data.toString().includes('Host')){
                    data = self.addProxyAuth(data);
                }
                client.write(data.data, function(err){
                    if(err&&params.verbose){
                        console.log('Error writing data to: ');
                        console.dir(client);
                        console.dir(err);
                        sendLog('Error writing data to: '+util.inspect(client)+' '+util.inspect(err));
                        conn.emit('htmlrecv', 
                            { id : id, data : null, finished : true }
                        );
                        connection_list[id].established=false;
                        client.end();
                        client.destroy();
                        connection_list[id].ended=true;
                    }
                    outbound+=1;
                    if(params.verbose){
                        console.log('Wrote to TCP socket '+id);
                        sendLog('Wrote to TCP socket '+id);
                    }

                });
            }
        });
    }

    self.spin = function(old,msg){
        inbound = 0;
        outbound = 0;
        gfx.draw(getInbound(),getOutbound(),old,msg,self.tType);
        self.drawTimeout = setInterval(function(){
            gfx.draw(getInbound(),getOutbound(),old,msg,self.tType);
            inbound = 0;
            outbound = 0;
        }, 1000);
        process.stdout.on('resize', function() {
            clearInterval(self.drawTimeout);
            gfx.draw(getInbound(),getOutbound(),old,msg,self.tType);
            self.drawTimeout = setInterval(function(){
                gfx.draw(getInbound(),getOutbound(),old,msg,self.tType);
                inbound = 0;
                outbound = 0;
            }, 1000);
        });
    }

    self.addProxyAuth = function(data){
        var dataArr = data.data.toString().split('\r\n');
        dataArr = _.filter(dataArr,function(col){
            if(!col==''){
                return col;
            }
        });
        dataArr.push(proxyAuthString);
        dataArr.push('\r\n');
        dataStr = dataArr.join('\r\n');
        data.data = Buffer.from(dataStr);
        return data;
    }

    self.end = function(cb){
        clearInterval(self.drawTimeout);
        clearInterval(self.ping);
        var optionsDelete = {
            url: 'https://'+self.tunnelapi,
            method: 'DELETE',
            headers: {
                authorization: 'authorized '+self.auth_header
            },
            qs: {
                state:10
            }
        }

        request(optionsDelete,function(error,response,body){
            if(!error && response.statusCode==200){
                if(!_.isUndefined(self.server)&&!_.isNull(self.server)){
                    self.server.close();
                }
                for(connection in connection_list){
                    if(socketExists(connection.id)){
                        connection.client.end();
                    }
                }
                body=JSON.parse(body);
                if(self.conn){
                    self.conn.disconnect();
                }
                cb(null,'killit');
            }else{
                cb(error,null);
                console.log(error);
            }
        });

        if(self.ready){
            fs.unlink(self.ready,function(err){
                if(err){
                    console.log(err);
                    setTimeout(function(){
                        process.exit(1);
                    },10000);
                } 
            })
        }
    }

    self.endWrap = function(){
        self.end(function(err,killit){
            if(!err&&killit==='killit'){
                console.log('Bye!');
                process.exit(0);
            }else if(err){
                console.log(err);
                setTimeout(function(){
                    process.exit(1);
                },10000);
            }
        });
    }

    function socketExists(id){
        //TODO this looks dumb
        if ((!_.isUndefined(connection_list[id]) && !_.isNull(connection_list[id]))&&(!_.isUndefined(connection_list[id].client) && !_.isNull(connection_list[id].client))&&(!connection_list[id].ended)&&(connection_list[id].established)&&(Object.getOwnPropertyNames(connection_list[id].client.address()).length > 0)){
            return true;
        }else{
            return false;
        }
    }
}

module.exports = cbtSocket;











