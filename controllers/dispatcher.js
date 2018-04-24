import PubSub from 'pubsub-js';
import jwt from 'jsonwebtoken';
import configs from '../configs';
import session from '../lib/session';
import random from "random-id";

import users from '../models/user';

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
    // variables for dev testing
    this.test_func = "";
    this.test_session_id = "";
    // handlers for the dispatcher
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
    var disconnectUser_func = function (event_name, data) {
      var rand = data['rand_user'];
      console.log("User Disconnect: ", rand);
      var id = self.randToID[rand];
      for (var i = 0; i < self.global_player_pool.length; i++) {
        if (id == self.global_player_pool[i]) { self.global_player_pool.splice(i, 1); }
      }
      // Checks if the user has disconnect when in a session.
      if (self.playerToSession[rand] != undefined) {
        self.sessions[self.playerToSession[data['rand_user']]].playerDisconnected(data);
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
    var terminateSession_func = function (event_name, data) {
      console.log("Terminate Session: ", data['session_id']);
      delete self.sessions[data['session_id']];
    };
    // sets the pubsub handlers for the dispatcher
    this.readyForSession_pubsub = PubSub.subscribe('readyForSession', readyForSession_func);
    this.readyPlayer_pubsub = PubSub.subscribe('playerReady', readyPlayer_func);
    this.readyNotPlayer_pubsub = PubSub.subscribe('playerNotReady', readyNotPlayerr_func);
    this.sessionPrestartConfirm_pubsub = PubSub.subscribe('sessionPrestartConfirm', sessionPrestartConfirm_func);
    this.sendFrame_pubsub = PubSub.subscribe('sendFrame', sendFrame_func);
    this.completedRound_pubsub = PubSub.subscribe('completedRound', completedRound_func);
    this.exitSessionQuene_pubsub = PubSub.subscribe('exitSessionQuene', exitSessionQuene_func);
    this.confirmedConnection_pubsub = PubSub.subscribe('confirmedSession', confirmed_connection_func);
    this.leaveSession_pubsub = PubSub.subscribe('leaveSession', leaveSessionn_func);
    this.disconnectUser_pubsub = PubSub.subscribe('disconnectUser', disconnectUser_func);
    this.terminateSession_pubsub = PubSub.subscribe('terminateSession', terminateSession_func);
  }

  loop() {
    // size of the session
    var session_size = 2;
    // debugging info
    //console.log("=========================================");
    //console.log("global_player_pool -> ", this.global_player_pool.length);
    //console.log("sessions_pool -> ", Object.keys(this.sessions));
    // checks if the global pool has enough players to dispatch
    if (this.global_player_pool.length >= session_size) {
      var current_session_players = {};
      var current_session_sockets = {};
      var current_session_id_randon = {};
      var session_id = random(50,"aA0");
      var function_name = random(25,"aA0");
      var player_ids = [];
      // picks the players for the session and sets valids
      for (var i = 0; i < session_size; i++) {
        var rand_index = Math.floor(Math.random() * this.global_player_pool.length);
        var id = this.global_player_pool[rand_index];
        player_ids.push(id);
        var player = this.readyForSession[id];
        current_session_players[id] = { "id":id, "player":player };
        //current_session_players.push({ "id":id, "player":player, "player_profile":{} });
        current_session_sockets[player] = this.sockets[this.randToID[player]];
        this.playerToSession[player] = session_id;
        this.global_player_pool.splice(rand_index, 1);
        //TODO: this.sockets[id].join(session_id);
      }

      var self = this;
      users.find({'_id': { $in: player_ids  } }, function(err, profiles){

          //console.log(profiles);
          var allplayers = [];
          for (var i = 0; i < profiles.length; i++) {
            var profile = JSON.parse(JSON.stringify(profiles[i]));
            delete profile['id'];
            delete profile['password'];
            delete profile['updatedAt'];
            delete profile['createdAt'];

            current_session_players[profile['_id']]['player_profile'] = profile;
            allplayers.push(current_session_players[profile['_id']]);
          }
          // creates the session and releases to the players
          var current_session = new session(
            self.io,
            session_id,
            function_name,
            allplayers,
            current_session_sockets
          );
          // stores the session in the dispatcher and releases to the player
          self.sessions[session_id] = current_session;
          current_session.release();
      });

    }
  }

  start() {
    // starts the interval timer for session dispatching
    var self = this;
    this.interval_object = setInterval(function() { self.loop() }, 4000);
  }

  kill() {
    // unsubscribing from the pubsub
    PubSub.unsubscribe(this.readyForSession_pubsub);
    PubSub.unsubscribe(this.exitSessionQuene_pubsub);
    PubSub.unsubscribe(this.confirmedConnection_pubsub);
    PubSub.unsubscribe(this.leaveSession_pubsub);
    PubSub.unsubscribe(this.disconnectUser_pubsub);
    PubSub.unsubscribe(this.readyNotPlayer_pubsub);
    PubSub.unsubscribe(this.readyPlayer_pubsub);
    PubSub.unsubscribe(this.sessionPrestartConfirm_pubsub);
    PubSub.unsubscribe(this.sendFrame_pubsub);
    PubSub.unsubscribe(this.completedRound_pubsub);
    // stops the dispatcher timer
    clearInterval(this.interval_object);
  }

}
