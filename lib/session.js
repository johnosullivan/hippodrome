'use strict';

import PubSub from 'pubsub-js';

// Session states
const STATE_SESSION_WAITING_PLAYER_READY = "STATE_SESSION_WAITING_PLAYER_READY";
const STATE_SESSION_PRESTART = "STATE_SESSION_PRESTART";
const STATE_SESSION_RUNNING = "STATE_SESSION_RUNNING";
const STATE_SESSION_COMPLETED = "STATE_SESSION_COMPLETED";
const STATE_SESSION_FOUND = "STATE_SESSION_FOUND";
const STATE_SESSION_COUNTDOWN = "STATE_SESSION_COUNTDOWN";
// Session Events Types
const SESSION_PRESTART = "SESSION_PRESTART";
const SESSION_COUNTDOWN_START = "SESSION_COUNTDOWN_START";
const SESSION_COUNTDOWN_INTERVAL = "SESSION_COUNTDOWN_INTERVAL";
const SESSION_COMPLETED_OVERVIEW = "SESSION_COMPLETED_OVERVIEW";
const SESSION_GO = "SESSION_GO";
const JOIN_SESSION_FOUND = "JOIN_SESSION_FOUND";
const SESSION_PLAYER_READY = "SESSION_PLAYER_READY";
const SESSION_PLAYER_DISCONNECTED = "SESSION_PLAYER_DISCONNECTED";
const SESSION_PLAYER_NOT_READY = "SESSION_PLAYER_NOT_READY";
const SESSION_FRAME = "SESSION_FRAME";

module.exports = class session {

  constructor(_io, _session_id, _function_name, _players, _sockets) {
    this.io = _io;
    this.session_id = _session_id;
    this.function_name = _function_name;
    this.players = _players;
    this.sockets = _sockets;
    this.state_status = STATE_SESSION_WAITING_PLAYER_READY;
    this.startTimeDate = 0;
    this.endTimeDate = 0;
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
    if (status) {
      this.prestart();
    }
  }

  prestart() {
    this.state_status = STATE_SESSION_PRESTART;
    this.sendEvent({
      "type": SESSION_PRESTART,
      "function_name": this.function_name,
      "session_id": this.session_id,
      "session_state": this.state_status
    });
  }

  sendEvent(data, from) {
    for (var i = 0; i < this.players.length; i++) {
      this.sockets[this.players[i].player].emit(this.players[i].player, data);
    }
  }

  sendFrameExecute(data) {
    var payObj = data.user['payload'];
    payObj["session_state"] = this.state_status;
    payObj["type"] = SESSION_FRAME;
    for (var i = 0; i < this.players.length; i++) {
      var player = this.players[i].player;
      var socket = this.sockets[player];
      if (player !== data['rand_user']) {
        socket.emit(this.function_name,payObj);
      }
    }
  }

  sendFrame(data) {
    if (this.state_status == STATE_SESSION_FOUND) { this.sendFrameExecute(data);
    } else if (this.state_status == STATE_SESSION_RUNNING) { this.sendFrameExecute(data);
    } else { return; }
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
    if (this.state_status != STATE_SESSION_PRESTART) { return; }
    var rand_user = data['rand_user'];
    var status = true;
    for (var i = 0; i < this.players.length; i++) { if (this.players[i].player == rand_user) { this.players[i].prestart = true; } }
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].prestart;
      if (!p_status) { status = false; }
    }
    if (status) {
      this.state_status = STATE_SESSION_COUNTDOWN;
      this.sendEvent({
        "type": SESSION_COUNTDOWN_START,
        "session_state": this.state_status
      });
      this.time_count = 0;
      this.time_limit = 10;
      var self = this;
      this.timer = setInterval(function(){
        if (self.time_limit === self.time_count) { self.stopCountDown(); }
        else {
          var count = self.time_limit - self.time_count;
          self.sendEvent({
            "type": SESSION_COUNTDOWN_INTERVAL,
            "count": count,
            "session_state": this.state_status
          });
          self.time_count++;
        }
      }, 1000);
    }
  }

  stopCountDown() {
    clearInterval(this.timer);
    this.startTimeDate = new Date().getTime();
    this.state_status = STATE_SESSION_RUNNING;
    this.sendEvent({
      "type": SESSION_GO
    });
  }

  playerDisconnected(data) {
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) {
        this.players.splice(i, 1);
      }
    }
    delete this.sockets[rand_user];
    if (this.players.length == 0) {
      this.closeSession();
    } else {
      this.sendEvent({
        "type":SESSION_PLAYER_DISCONNECTED,
        "rand_user":rand_user,
        "session_state": this.state_status,
        "players": this.players
      });
    }
  }

  gameover() {
    this.state_status = STATE_SESSION_COMPLETED;
    this.endTimeDate = new Date().getTime();
    var time_elapsed = this.endTimeDate - this.startTimeDate;
    this.sendEvent({
      "type": SESSION_COMPLETED_OVERVIEW,
      "time_elapsed": time_elapsed,
      "session_id": this.session_id,
      "players_results": this.final_results ,
      "session_state": this.state_status
    });
    for (var i = 0; i < this.players.length; i++) {
      var player = this.players[i].player;
      var socket = this.sockets[player];
      socket.disconnect();
    }
    this.closeSession();
  }

  release() {
    this.state_status = STATE_SESSION_FOUND;

    var clean_player_array = this.players;

    clean_player_array.forEach(function(player){
      delete player.finished
      delete player.prestart
      delete player.ready
      delete player.id
    });

    this.sendEvent({
      "type":JOIN_SESSION_FOUND,
      "function_name":this.function_name,
      "session_id": this.session_id,
      "session_state": this.state_status,
      "players": this.players
    });
  }

  playerReady(data) {
    if (this.state_status != STATE_SESSION_FOUND) { return; }
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) { this.players[i].ready = true; }
    }
    this.sendEvent({
      "type":SESSION_PLAYER_READY,
      "rand_user":rand_user,
      "session_state": this.state_status
    });
    this.checkIsReady();
  }

  playerNotReady(data) {
    if (this.state_status != STATE_SESSION_FOUND) { return; }
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) { this.players[i].ready = false; }
    }
    this.sendEvent({
      "type":SESSION_PLAYER_NOT_READY,
      "rand_user":rand_user,
      "session_state": this.state_status
    });
    this.checkIsReady();
  }



  closeSession() { PubSub.publish('terminateSession', { "session_id": this.session_id }); }

}
