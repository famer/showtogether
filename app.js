var express = require('express')
        , app = express()
        , path = require("path")
        , server = require('http').createServer(app)
        , io = require('socket.io').listen(server);

server.listen(process.env.PORT || 8080);


app.configure(function() {
   //app.set('view engine', 'jade');
   //app.set('views', __dirname + '/views');
   app.use(express.bodyParser({uploadDir: __dirname + '/files'}));
   app.use(express.static(path.join(__dirname, 'public')));
});

var mongo = require('mongodb');
var Server = mongo.Server;
var Db = mongo.Db;
var BSON = mongo.BSONPure;
var GridStore = mongo.GridStore;
var crypto = require('crypto');
//var console = require('util');


var server = new Server(process.env.IP, 27017, {auto_reconnect : true});
var db = new Db('showtogether', server);
//var db = new Db('vids', new Server(process.env.IP, 27017, {auto_reconnect : true}), {w: 1});
var collectionName = 'pictures'

var sockets = [];

app.get('/mongo', function(req, res) {
    /*db.open(function(err, client) {
        db.collection('vids', function(err, collection) {
            collection.count(function(err, count) {
              console.log(count);
            });
            collection.findOne({}, function(err, item) {
               res.send(item);
            });
        });
    });*/ 
    db.open(function(err, client) {
    new GridStore(db, "connect.html", "w").open(function(err, gridStore) {
            if ( err ) {
                console.log(err);
            }
            console.log('###', 'gridfs connected');
            gridStore.writeFile(__dirname + "/connect.html", function(err, fileInfo) {
                if ( err ) {
                    console.log(err);
                }
                console.log('###', 'gridfs uploaded', fileInfo);
            });
            
        });
    });
});

app.get('/', function(req, res) {
        res.redirect("/c/");
        res.send("hello");
});

app.get('/files/:name', function(req, res) {
        res.sendfile(__dirname + "/files/"+req.params.name);
});

app.get('/mongofiles/:name', function(req, res) {
        /*db.open(function(err, client) {
            
            new GridStore(db, req.params.name, "r").open(function(err, gridStore) {
                if ( err ) {
                    console.log(err);
                }
                var stream = gridStore.stream(true);
                stream.on("end", function(err) { 
                    db.close();
                });
                stream.pipe(res);
                
            });
            
        });*/
        
        db.open(function(err, client) {
            new GridStore.read(db, req.params.name, function(err, data) {
              res.end(data);
              db.close();
            
            });
        });
});

app.get('/mongofilesid/:id', function(req, res) {
        var objectId =  new BSON.ObjectID(req.params.id);
         
        db.open(function(err, client) {
            new GridStore.read(db, objectId, function(err, data) {
                
              res.end(data);
              db.close();
            
            });
        });
});

app.post('/upload', function(req, res, next) {
        var fs = require('fs');
        var hash = req.body.hash;
        var socket_id = req.body.socket_id;
        var newfilename = socket_id;
        console.log('upload');
        var my, yours;
        for ( var i in io.sockets.clients(hash) ) {
            if ( io.sockets.clients(hash)[i].id != socket_id ) {
                yours = io.sockets.clients(hash)[i];
            } else {
                my = io.sockets.clients(hash)[i];
            }
        }
        
        
        var file = req.files.image;
        
        var sig = crypto.createHash('md5');
        /*var s = fs.ReadStream(file.path);
        s.on('data', function(d) {
          sig.update(d);
        });
        
        s.on('end', function() {
          var md5 = sig.digest('hex');
          console.log(md5 + '  ' + file.path);
        });
        */
        fs.readFile(file.path, function(err, data) {
            var md5 = sig.update(data).digest('hex');
            console.log(md5);
        });
        
        db.open(function(err, client) {
            db.collection(collectionName, function(err, collection) {
                var picture = {
                    'hash': hash,
                    'socketId': socket_id
                    //'opponentSocketId': yours.store.id, // chech if any
                    
                };
                collection.save(picture);
            });
            
            new GridStore(db, newfilename, "w", { "content_type": file.type }).open(function(err, gridStore) {
                if ( err ) {
                    console.log(err);
                }
                console.log('###', 'gridfs connected');
                gridStore.writeFile(file.path, function(err, fileInfo) {
                    if ( err ) {
                        console.log(err);
                    }
                    /*
                    if (fileInfo.md5 !== md5) {
                        //delete bad file
                        GridStore.unlink(db, newfilename, function (err, gridStore) {
                            if (err) {
                                throw err;
                            }
                        });
                    } else {
                        
                    }*/
                    //console.log('###', 'gridfs uploaded', fileInfo);
                    my.emit('showMyImage', {'src': "/mongofiles/"+newfilename});
                    fs.unlinkSync(file.path);
                    db.close();
                });
                
            });
            
        });
        //var grid = new Grid(db);
        /*var gs = new mongo.GridStore(db, socket_id + ".png", "w");
        gs.open(function(err, gs){
            gs.writeFile( file.path, function(err, gs) {
                console.log('~~~stored~~~', socket_id + ".png");
            });
            console.log("this file was uploaded at "+gs.uploadDate);
        });*/
        
        
        
        /* return this
        fs.readFile(file.path, function(err, data) {
                fs.writeFile("./files/"+file.name, data, function(err) {
                    console.log(hash, 'UPLOAD HASH');
                    if ( yours ) {
                        if ( yours.uploaded ) {
                            yours.emit('showYoursImage', {'src': "/files/"+file.name});
                        } else {
                            yours.emit('uploaded', { author: 'yours'});
                        }
                    }
                    
                    my.emit('showMyImage', {'src': "/files/"+file.name});
                    my.uploaded = true;
                    my.uploadSrc = "/files/"+file.name;
                    
                    if ( yours && yours.uploadSrc ) {
                        my.emit('showYoursImage', {'src': yours.uploadSrc});
                    }
                    
                    res.send('upload success');
                });
        });
        */
        //fs.unlinkSync(file.path);
});

app.get('/c/', function(req, res) {
   var id = Math.random().toString(36).slice(2);
   res.redirect('/c/' + id);
});

app.get('/c/:id', function(req, res) {
   console.log(req.params.id);
   res.sendfile(__dirname + "/connect.html");
});

io.sockets.on('connection', function(socket) {
        socket.emit('pong', {connected: true});
        socket.on('connect', function(data) {
                var number;
                var hash = data.hash;
                
                var clientId = data.clientId;
                
                
                var sc = io.sockets.clients(hash);
                number = sc.length;
                if (number < 2) {
                    socket.join(hash);
                } else {
                    socket.emit('alert', {message: 'overcome'});
                }
                
                console.log(socket.store.id, 'SOCK###');
                
                
                
                
                data.number = number;
                
                socket.hash = hash;
                socket.number = number;
                
                
                socket.set('number', number);//, function() {});
                socket.set('hash', hash);
                
                socket.emit('pong', data);
                sockets[socket.store.id] = socket;
        });
        
        socket.on('getnumber', function(data) {
           socket.get('number', function(err, number) {
              socket.emit('pong', {number: number}); 
           });
        });
        
        socket.on('serve', function(data) {
                socket.emit('pong', data);
        });

        socket.on('ping', function(data) {
                socket.emit('pong', data);

        });
        
        socket.on('disconnect', function () {
            
            socket.leave(socket.hash);
            
            delete sockets[socket.store.id];
            
        });
});
