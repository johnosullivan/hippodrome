import cors from 'cors';
import express from 'express';
import http_lib from 'http';
import socketio from 'socket.io';
import bodyParser from 'body-parser';

var app = express();
var http = http_lib.Server(app);
var io = socketio(http);
var apiRoutes = express.Router();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization,Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

require('./routes/auth.js')(apiRoutes);

app.use('/api', apiRoutes);

io.on('connection', function(socket){
  console.log("User: ", socket.handshake);
});

http.listen(3000, function(){ });
