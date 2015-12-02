var net = require('net'),
    tls = require('tls'),
    connection_list = {},
    request = require('request'),
    _ = require('lodash'),
    gfx = require('./gfx.js'),
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


    self.startStaticServer = function(){
        self.localServe = require('express')();
        self.serveDir = require('serve-index');
        self.serveStatic = require('serve-static');
        self.directory = params.directory;
        var sPort = self.sPort = params.port;
        self.localServe.use('/', self.serveDir(self.directory, {'icons': true}));
        self.localServe.use('/', self.serveStatic(self.directory));
        self.server = self.localServe.listen(sPort);
        console.log("Server listening on "+sPort);
    }

    if(!params.debug){
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
        switch(tType){
            case 'simple':
            break;
            case 'webserver':
                self.startStaticServer();
            break;
            case 'tunnel':
                var tType = self.tType = 'tunnel';
                var port = proxyPort = params.proxyPort;
                var host = proxyHost = params.proxyIp;
            break;
            default:
        }
        var conn = self.conn = require('socket.io-client')(self.cbtServer,{path: self.path, query: self.query, reconnection: true, timeout: 999999999});

    }else{
        var tType = self.tType = params.tType;
        self.cbtServer = 'http://127.0.0.1:10000';
        self.path = (tType==='tunnel' ? '/wsstunnel-2000/socket.io/':'/wsstunnel-4000/socket.io/');
        self.query = 'userid=0&authkey=0&EIO=3&t=0&transport=polling';
        var conn = self.conn = require('socket.io-client')(self.cbtServer,{path: self.path, query: self.query});
        switch(tType){
            case 'simple':
            break;
            case 'server':
                self.localServe = require('express')();
                self.serveDir = require('serve-index');
                self.serveStatic = require('serve-static');
                self.directory = '/Users/bosh/Documents/';
                var sPort = self.sPort = 11000;
                self.startStaticServer(sPort);
            break;
            case 'tunnel':
                var tType = self.tType = 'tunnel';
                var port = proxyPort = '8888';
                var host = proxyHost = '127.0.0.1';
            break;
            default:

        }
    }

    self.start = function(cb){

        console.log('Started connection attempt!');

        conn.on('reconnect_error',function(e){
            console.log(e);
        });

        conn.on('connect_error',function(e){
            console.log(e);
        });

        conn.on("error", function(e){
            console.log('Socket.io error!');
            console.log(e.stack);
            cb(e);
        });

        conn.on('connect',function(){
            console.log('Connected!');
            cb(null,self);
        });

        conn.on('reconnect',function(){
            console.log('Reconnected! ...?');
        });

        conn.on("disconnect", function(data,err){
            console.log(data);
            console.log("Server.js disconnected.");
            self.end(function(err,killit){
                if(!err&&killit==='killit'){
                    process.exit(1);
                }else if(err){
                    console.log(err);
                    setTimeout(function(){
                        process.exit(1);
                    },10000);
                }
            });
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
                        console.log(id+" client ended by server.js.");
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
                if(host==='local'){
                    host='localhost';
                }
                if(params.verbose){
                    console.log('Creating TCP socket on: \n'+data._type+' '+host+' '+port+' '+id);
                }
                var client = self.client = connection_list[id].client = net.createConnection({allowHalfOpen:true,port: port,host: host},function(err){
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
                    console.log('Error on '+id+'!');
                    console.log(error.stack);
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
                    connection_list[id].established=false;
                    client.write('end');
                    client.end();
                    client.destroy();
                    connection_list[id].ended=true;
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
                        if(err){
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
                    if(err){
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
                        console.log(outbound);
                        console.log(id, 'Wrote to '+id);
                    }

                });
            }
            
        });
    }

    self.spin = function(old){
        inbound = 0;
        outbound = 0;
        gfx.draw(getInbound(),getOutbound(),old);
        self.drawTimeout = setInterval(function(){
            gfx.draw(getInbound(),getOutbound(),old);
            inbound = 0;
            outbound = 0;
        }, 1000);
        process.stdout.on('resize', function() {
            clearInterval(self.drawTimeout);
            gfx.draw(getInbound(),getOutbound(),old);
            self.drawTimeout = setInterval(function(){
                gfx.draw(getInbound(),getOutbound(),old);
                inbound = 0;
                outbound = 0;
            }, 1000);
        });
    }

    self.end = function(cb){
        clearInterval(self.drawTimeout);
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











