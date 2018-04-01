// imports all the libraries for hippodrome
import cors from 'cors';
import express from 'express';
import http_lib from 'http';
import socketio from 'socket.io';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import configs from './configs';
import mongoose from 'mongoose';
import dispatcher from './controllers/dispatcher';
import PubSub from 'pubsub-js';
// gets all the init of the app, http, and socketio.
var app = express();
var http = http_lib.Server(app);
var io = socketio(http);
var apiRoutes = express.Router();
// temp example of session holding
var sessions = [];
var readyForSession = {};
var dispatcher_controller = new dispatcher(io);
// connects to the mongodb
mongoose.Promise = global.Promise;
mongoose.connect(configs.database.address, { promiseLibrary: global.Promise });
// cors defined here.
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT");
  res.header("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, Accept");
  next();
});
// defines the body parser for the http calls.
app.set('jwt_secret', "loyolawins");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use('/status', express.static('status.html'));
// hippodrome system
require('./routes/hippodrome.js')(app, apiRoutes, jwt, io, express, sessions);
// populates the api routes for all the features.
require('./routes/authenticate.js')(app, apiRoutes, jwt);
// Validate token.
require('./routes/validate_token_route.js')(app, apiRoutes, jwt);
// pinging the network for testing
require('./routes/sessions.js')(app, apiRoutes, jwt, io, readyForSession);
// sets all the routes to api endpoint.
app.use('/api', apiRoutes);
//starts the dispatcher
dispatcher_controller.start();
// triggers when user connects to the hippodrome server.
io.on('connection', function(socket){
  //console.log("connection: ", socket.handshake);
  var rand_user_connection = "";
  socket.on('send_frame', function(payload){
    io.sockets.in(payload['session_id']).emit(payload['function_name'], payload['payload']);
  });
  socket.on('confirmedSession', function(payload){
    rand_user_connection = payload['rand_user'];
    PubSub.publish('confirmedSession', { 'user': payload, 'socket':socket });
  });
  socket.on('leaveSession', function(payload){
    PubSub.publish('leaveSession', { 'user': payload });
  });
  socket.on('disconnect', function () {
    PubSub.publish('disconnectSession', {"rand_user_connection":rand_user_connection});
  });
});
// starts the server with port 3000.
http.listen(3000, function(){
  // will print out the server details.
});
// catch the control-c and kill services
process.on('SIGINT', function() {
    dispatcher_controller.kill();
    process.exit();
});
