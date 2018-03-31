import PubSub from 'pubsub-js';
import jwt from 'jsonwebtoken';
import configs from '../configs';
import session from '../lib/session';
import random from "random-id";

const TOKEN_SECRET = configs.token.secret;

module.exports = class dispatcher {

  constructor(_io) {
    // sets the dispatcher controllers variables
    this.io = _io;

    this.readyForSession = {};
    this.interval_object = {};
    this.sockets = {};
    this.sessions = [];
    this.global_player_pool = [];

    this.test_func = "";
    this.test_session_id = "";

    var self = this;
    var readyForSession_func = function (event_name, data) {
      //console.log(event_name, data);
      self.readyForSession[data.user['_id']] = data.rand_user;
    };

    var exitSessionQuene_func = function (event_name, data) {
      //console.log(event_name, data);
      delete self.readyForSession[data.user['_id']];
    };

    var confirmed_connection_func = function (event_name, data) {
      var token = data.user['token'];
      var rand_user = data.user['rand_user'];
      var socket = data['socket'];
      //console.log(event_name, data);
      //console.log("token", token);
      //console.log("rand_user", rand_user);

      jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
          var id = decoded['id'];
          if (self.readyForSession[id] == rand_user) {
            self.sockets[id] = socket;
            self.global_player_pool.push(id);
          }
      });


    };

    this.readyForSession_pubsub = PubSub.subscribe('readyForSession', readyForSession_func);
    this.exitSessionQuene_pubsub = PubSub.subscribe('exitSessionQuene', exitSessionQuene_func);
    this.confirmedConnection_pubsub = PubSub.subscribe('confirmedConnection', confirmed_connection_func);
  }

  loop() {
    if (this.global_player_pool.length > 0) {

      var id = this.global_player_pool[0];
      var player = this.readyForSession[id];
      var session_id = random(50,"aA0");
      var function_name = random(25,"aA0");

      console.log("id -> ", id);
      console.log("player -> ", player);
      console.log("session_id -> ", session_id);
      console.log("function_name -> ", session_id);

      this.io.emit(player, { "type":"JOIN_SESSION_FOUND", "function_name":function_name, "session_id": session_id});

      this.sockets[id].join(session_id);

      this.global_player_pool.splice(0, 1);

    } else {

    }

  }

  disconnect(player) {

  }

  start() {
    var self = this;
    this.interval_object = setInterval(function() { self.loop() }, 5000);
  }

  kill() {
    clearInterval(this.interval_object);
  }

}
