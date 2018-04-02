'use strict';

import PubSub from 'pubsub-js';

module.exports = class session {

  constructor(_io, _session_id, _function_name, _players, _sockets) {
    this.io = _io;
    this.session_id = _session_id;
    this.function_name = _function_name;
    this.players = _players;
    this.sockets = _sockets;
    this.state_status = "STATE_SESSION_WAITING_PLAYER_READY";
    this.startTimeDate = "";
    this.endTimeDate = "";
    this.final_results = [];
    for (var i = 0; i < this.players.length; i++) {
      this.players[i]['ready'] = false;
      this.players[i]['prestart'] = false;
      this.players[i]['finished'] = false;
    }
  }

  checkIsReady() {
    var status = true;
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].ready;
      if (!p_status) { status = false; }
    }
    if (status) { this.prestart(); }
  }

  prestart() {
    this.sendPayload({ "type":"SESSION_PRESTART", "function_name":this.function_name, "session_id": this.session_id, "session_state": this.state_status});
  }

  sendPayload(data, from) {
    for (var i = 0; i < this.players.length; i++) {
      this.sockets[this.players[i].player].emit(this.players[i].player, data);
    }
  }

  sendFrame(data) {
    for (var i = 0; i < this.players.length; i++) {
      var player = this.players[i].player;
      var socket = this.sockets[player];
      if (player !== data['rand_user']) {
        var payObj = data.user['payload'];
        payObj["session_state"] = this.state_status;
        socket.emit(this.function_name,payObj);
      }
    }
  }

  completedRound(data) {
    var rand_user = data['rand_user'];
    data.user.results['rand_user'] = rand_user
    var result = data.user.results;
    this.final_results.push(result);
    var status = true;
    for (var i = 0; i < this.players.length; i++) { if (this.players[i].player == rand_user) { this.players[i].finished = true; } }
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].finished;
      if (!p_status) { status = false; }
    }
    if (status) { this.gameover(); }
  }

  sessionPrestartConfirm(data) {
    var rand_user = data['rand_user'];
    var status = true;
    for (var i = 0; i < this.players.length; i++) { if (this.players[i].player == rand_user) { this.players[i].prestart = true; } }
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].prestart;
      if (!p_status) { status = false; }
    }
    if (status) {
      this.state_status = "STATE_SESSION_COUNTDOWN";
      this.sendPayload({ "type":"SESSION_COUNTDOWN_START", "session_state": this.state_status });
      this.time_count = 0;
      this.time_limit = 10;
      var self = this;
      this.timer = setInterval(function(){
        if (self.time_limit === self.time_count) { self.stopCountDown(); }
        else {
          var count = self.time_limit - self.time_count;
          self.sendPayload({ "type":"SESSION_COUNTDOWN_INTERVAL", "count":count, "session_state": this.state_status  });
          self.time_count++;
        }
      }, 1000);
    }
  }

  stopCountDown() {
    clearInterval(this.timer);
    this.sendPayload({ "type":"SESSION_GO" });
    this.startTimeDate = new Date().getTime();
    this.state_status = "STATE_SESSION_RUNNING";
  }

  gameover() {
    this.state_status = "STATE_SESSION_COMPLETED";
    this.endTimeDate = new Date().getTime();
    var time_elapsed = this.endTimeDate - this.startTimeDate;
    this.sendPayload({ "type": "SESSION__COMPLETED_OVERVIEW", "time_elapsed": time_elapsed, "session_id": this.session_id, "players_results": this.final_results , "session_state": this.state_status});
    for (var i = 0; i < this.players.length; i++) {
      var player = this.players[i].player;
      var socket = this.sockets[player];
      socket.disconnect();
    }
    this.closeSession();
  }

  release() {
    this.sendPayload({ "type":"JOIN_SESSION_FOUND", "function_name":this.function_name, "session_id": this.session_id , "session_state": this.state_status});
  }

  playerReady(data) {
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) { this.players[i].ready = true; }
    }
    this.sendPayload({ "type":"SESSION_PLAYER_READY", "rand_user":rand_user, "session_state": this.state_status});
    this.checkIsReady();
  }

  playerNotReady(data) {
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) { this.players[i].ready = false; }
    }
    this.sendPayload({ "type":"SESSION_PLAYER_NOT_READY", "rand_user":rand_user, "session_state": this.state_status });
    this.checkIsReady();
  }

  closeSession() { PubSub.publish('terminateSession', { "session_id": this.session_id }); }

}
