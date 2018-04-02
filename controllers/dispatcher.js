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
    this.sessions = {};
    this.global_player_pool = [];

    this.playerToSession = {};

    this.test_func = "";
    this.test_session_id = "";



    var self = this;
    var readyForSession_func = function (event_name, data) {
      self.readyForSession[data.user['_id']] = data.rand_user;
    };

    var exitSessionQuene_func = function (event_name, data) {
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

    var readyPlayer_func = function (event_name, data) {
      self.sessions[self.playerToSession[data['rand_user']]].playerReady(data);
    };

    var readyNotPlayerr_func = function (event_name, data) {
      self.sessions[self.playerToSession[data['rand_user']]].playerNotReady(data);
    };

    var sessionPrestartConfirm_func = function (event_name, data) {
      self.sessions[self.playerToSession[data['rand_user']]].sessionPrestartConfirm(data);
    };

    var sendFrame_func = function (event_name, data) {
      self.sessions[self.playerToSession[data['rand_user']]].sendFrame(data);
    };

    var completedRound_func = function (event_name, data) {
      self.sessions[self.playerToSession[data['rand_user']]].completedRound(data);
    };

    this.readyForSession_pubsub = PubSub.subscribe('readyForSession', readyForSession_func);

    this.readyPlayer_pubsub = PubSub.subscribe('playerReady', readyPlayer_func);
    this.readyNotPlayer_pubsub = PubSub.subscribe('playerNotReady', readyNotPlayerr_func);
    this.sessionPrestartConfirm_pubsub = PubSub.subscribe('sessionPrestartConfirm', sessionPrestartConfirm_func);
    this.sendFrame_pubsub = PubSub.subscribe('sendFrame', sendFrame_func);

    this.completedRound_pubsub = PubSub.subscribe('completedRound', completedRound_func);

    this.exitSessionQuene_pubsub = PubSub.subscribe('exitSessionQuene', exitSessionQuene_func);
    this.confirmedConnection_pubsub = PubSub.subscribe('confirmedSession', confirmed_connection_func);
    this.leaveSession_pubsub = PubSub.subscribe('leaveSession', leaveSessionn_func);
    this.disconnectSession_pubsub = PubSub.subscribe('disconnectSession', disconnectSession_func);
  }

  loop() {

    var session_size = 3;

    //console.log("global_player_pool -> ", this.global_player_pool);

    if (this.global_player_pool.length >= session_size) {

      var current_session_players = [];
      var current_session_sockets = {};
      var session_id = random(50,"aA0");
      var function_name = random(25,"aA0");

      for (var i = 0; i < session_size; i++) {

        var rand_index = Math.floor(Math.random() * this.global_player_pool.length);

        var id = this.global_player_pool[rand_index];
        var player = this.readyForSession[id];

        var title = "player #" + (i + 1) + " -> ";
        console.log(title, player);

        current_session_players.push({ "id":id, "player":player });
        current_session_sockets[player] = this.sockets[this.randToID[player]];
        //this.sockets[id].join(session_id);
        this.playerToSession[player] = session_id;
        this.global_player_pool.splice(rand_index, 1);
      }

      var current_session = new session(this.io,session_id,function_name,current_session_players, current_session_sockets);
      this.sessions[session_id] = current_session;
      current_session.release();

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
    PubSub.unsubscribe(this.readyNotPlayer_pubsub);
    PubSub.unsubscribe(this.readyPlayer_pubsub);
    PubSub.unsubscribe(this.sessionPrestartConfirm_pubsub);
    PubSub.unsubscribe(this.sendFrame_pubsub);
    PubSub.unsubscribe(this.completedRound_pubsub);
    // stops the dispatcher timer
    clearInterval(this.interval_object);
  }

}
