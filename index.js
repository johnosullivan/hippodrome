// imports all the libraries for hippodrome
import cors from 'cors';
import express from 'express';
import http_lib from 'http';
import socketio from 'socket.io';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
// gets all the init of the app, http, and socketio.
var app = express();
var http = http_lib.Server(app);
var io = socketio(http);
var apiRoutes = express.Router();
// cors defined here.
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization,Origin, X-Requested-With, Content-Type, Accept");
  next();
});
// defines the body parser for the http calls.
app.set('jwt_secret', "loyolawins");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use('/status', express.static('status.html'));
// hippodrome system
require('./routes/hippodrome.js')(app, apiRoutes, jwt, io, express);
// populates the api routes for all the features.
require('./routes/authenticate.js')(app, apiRoutes, jwt, io);
// Validate token.
require('./routes/validate_token_route.js')(app, apiRoutes, jwt);
// pinging the network for testing
require('./routes/ping.js')(app, apiRoutes, jwt, io);
// sets all the routes to api endpoint.
app.use('/api', apiRoutes);
// triggers when user connects to the hippodrome server.
io.on('connection', function(socket){
  socket.on('send_frame', function(payload){
    var session = (payload.session !== undefined) ? payload.session : undefined;
    var frame = (payload.frame !== undefined) ? payload.frame : undefined;
    io.emit(session,frame);
  });
});
// starts the server with port 3000.
http.listen(3000, function(){
  // will print out the server details.
});
