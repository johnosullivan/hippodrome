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
    this.randToID = {};
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
      jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
          var id = decoded['id'];
          if (self.readyForSession[id] == rand_user) {
            self.sockets[id] = socket;
            self.global_player_pool.push(id);
            self.randToID[rand_user] = id;
          }
      });
    };

    var leaveSessionn_func = function (event_name, data) {
      var token = data.user['token'];
      var rand_user = data.user['rand_user'];
      var session_id = data.user['session_id'];
      jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
          var id = decoded['id'];
          if (self.readyForSession[id] == rand_user) {
            self.sockets[id].leave(session_id);
            self.sockets[id].disconnect();
            delete self.sockets[id];
            delete self.readyForSession[id];
          }
      });
    };

    var disconnectSession_func = function (event_name, data) {
      var rand = data['rand_user_connection'];
      var id = self.randToID[rand];
      for (var i = 0; i < self.global_player_pool.length; i++) {
        if (id == self.global_player_pool[i]) {
          self.global_player_pool.splice(i, 1);
        }
      }
      delete self.sockets[id];
      delete self.readyForSession[id];
    };

    this.readyForSession_pubsub = PubSub.subscribe('readyForSession', readyForSession_func);
    this.exitSessionQuene_pubsub = PubSub.subscribe('exitSessionQuene', exitSessionQuene_func);
    this.confirmedConnection_pubsub = PubSub.subscribe('confirmedSession', confirmed_connection_func);
    this.leaveSession_pubsub = PubSub.subscribe('leaveSession', leaveSessionn_func);
    this.disconnectSession_pubsub = PubSub.subscribe('disconnectSession', disconnectSession_func);
  }

  loop() {

    var session_size = 3;

    console.log("global_player_pool -> ", this.global_player_pool);

    if (this.global_player_pool.length >= session_size) {

      var current_session_players = [];

      var session_id = random(50,"aA0");
      var function_name = random(25,"aA0");

      console.log("session_id -> ", session_id);
      console.log("function_name -> ", session_id);

      for (var i = 0; i < 3; i++) {

        var rand_index = Math.floor(Math.random() * this.global_player_pool.length);

        var id = this.global_player_pool[rand_index];
        var player = this.readyForSession[id];

        var title = "player #" + (i + 1) + " -> ";
        console.log(title, player);

        current_session_players.push(id);

        this.io.emit(player, { "type":"JOIN_SESSION_FOUND", "function_name":function_name, "session_id": session_id});

        this.sockets[id].join(session_id);

        this.global_player_pool.splice(rand_index, 1);

      }

      console.log("current_session_players -> ", current_session_players);


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
    // unsubscribing from the pubsub
    PubSub.unsubscribe(this.readyForSession_pubsub);
    PubSub.unsubscribe(this.exitSessionQuene_pubsub);
    PubSub.unsubscribe(this.confirmedConnection_pubsub);
    PubSub.unsubscribe(this.leaveSession_pubsub);
    PubSub.unsubscribe(this.disconnectSession_pubsub);
    // stops the dispatcher timer
    clearInterval(this.interval_object);
  }

}
