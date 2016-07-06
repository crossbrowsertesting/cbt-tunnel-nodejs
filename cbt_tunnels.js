var net = require('net'),
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
    self.path = '/wsstunnel' + self.qPort + '/socket.io';
    self.query = 'userid=' + self.userId + '&authkey=' + self.authkey;
    self.tunnelapi = params.urls.node+'/api/v3/tunnels/'+params.tid;
    self.ready = params.ready;
    switch(tType){
        case 'simple':
        break;
        case 'webserver':
            self.startStaticServer(0);
        break;
        case 'tunnel':
            var tType = self.tType = 'tunnel';
            var port = proxyPort = params.proxyPort;
            var host = proxyHost = params.proxyIp;
        break;
        default:
    }
    var conn = self.conn = require('socket.io-client')(self.cbtServer,{path: self.path, query: self.query, reconnection: true});

    self.start = function(cb){

        var reconnecting = false;

        var ping = setInterval(function(){
            conn.emit('ping');
        },10000);

        console.log('Started connection attempt!');

        conn.on('reconnect_error',function(e){
            if(params.verbose){
                console.log(e);
            }
        });

        conn.on('connect_error',function(e){
            if(params.verbose){
                console.log(e);
            }
        });

        conn.on("error", function(e){
            console.log('Socket.io error!');
            console.log(e.stack);
            cb(e);
        });

        conn.on('connect',function(){
            console.log('Connecting as '+self.tType+'...');
            if(!reconnecting){
                cb(null,self);
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
                        });
                    }
                });
            }
        });

        conn.on('reconnect',function(){
            warn('Reconnected!');
        });

        conn.on("disconnect", function(data){
            reconnecting = true;
            if(!params.verbose){
                clearInterval(self.drawTimeout);
                self.spin(null,'Disconnected from CBT server — if this persists, please exit this client and try again.\n');
            }else{
                console.log('Disconnected from CBT server — if this persists, please exit this client and try again.\n');
            }
            connection_list = {};
        });

        conn.on("hello", function() {
            conn.emit('established');
        });

        conn.on("progress",function(data){
            console.log('progress\n');
            console.log(data);
        });

        conn.on('versions',function(data){
            utils.checkVersion(data,params);
        });

        conn.on("data", function(data,fn){
            var id = data.id;
            if (!connection_list[id]) {
                connection_list[id] = { id : data.id , client : null };
                connection_list[id].established=false;
            }

            if(socketExists(id) && data._type === 'end'){
                if(connection_list[data.id].client){
                    if(params.verbose){
                        console.log(id+" client ended by CBT server.");
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
                var port = self.port = ( tType==='tunnel' ? proxyPort : data.port );
                var host = self.host = ( tType==='tunnel' ? proxyHost : data.host );
                if(host==='local'&&self.tType==='webserver'){
                    host='localhost';
                    port = self.sPort;
                }else if(host==='local'){
                    host='localhost';
                }
                if(params.verbose){
                    console.log('Creating TCP socket on: \n'+data._type+' '+host+' '+port+' '+id);
                }
                var client = self.client = connection_list[id].client = net.createConnection({allowHalfOpen:true, port: port,host: host},function(err){
                    if(err){
                        console.log(err);
                    }
                    connection_list[id].established = true;
                    connection_list[id].ended = false;
                    if(fn){
                        fn('ack ack ack');
                    }
                    if(params.verbose){
                        console.log('Done creating TCP socket!');
                    }
                });
            
                client.on('error',function(error){
                    if(params.verbose){
                        console.log('Error on '+id+'!');
                        console.log(error.stack);
                    }
                    conn.emit("htmlrecv", 
                        { id : id, data : null, finished : true }
                    );
                    connection_list[id].established=false;
                    client.end();
                    connection_list[id].ended=true;
                });

                client.on('data', function(data){
                    if(socketExists(id)){
                        if(params.verbose){
                            console.log('TCP socket '+id+' received data from the internet! '+port+' '+host);
                        }
                        conn.emit("htmlrecv",
                            { id : id, data : data, finished : false }
                        );
                        if(params.verbose){
                            console.log('TCP socket '+id+' internet data emitted to server.js!');
                        }
                    }
                });

                client.setTimeout(10000);

                client.on('timeout',function(data){
                    if(params.verbose){
                        console.log(id+" session timed out.");
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
                            console.log(id+" socket ended by external site.");
                        }
                        conn.emit("htmlrecv", 
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
                            console.log(id+" socket closed by external site.");
                        }
                        if(err&&params.verbose){
                            console.log('Error on close of '+id);
                        }
                        conn.emit("htmlrecv", 
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
                client=connection_list[id].client;
                client.write(data.data, function(err){
                    if(err&&params.verbose){
                        console.log("Error writing!");
                        console.log(err);
                        conn.emit("htmlrecv", 
                            { id : id, data : null, finished : true }
                        );
                        connection_list[id].established=false;
                        client.end();
                        client.destroy();
                        connection_list[id].ended=true;
                    }
                    outbound+=1;
                    if(params.verbose){
                        console.log(id, 'Wrote to '+id);
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

    self.end = function(cb){
        clearInterval(self.drawTimeout);
        clearInterval(self.ping);
        var optionsDelete = {
            url: 'http://'+self.tunnelapi,
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
        if ((!_.isUndefined(connection_list[id]) && !_.isNull(connection_list[id]))&&(!_.isUndefined(connection_list[id].client) && !_.isNull(connection_list[id].client))&&(!connection_list[id].ended)&&(connection_list[id].established)&&(Object.getOwnPropertyNames(connection_list[id].client.address()).length > 0)){
            return true;
        }else{
            return false;
        }
    }
}

module.exports = cbtSocket;











