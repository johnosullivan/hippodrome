'use strict';

module.exports = class session {

  constructor(_io, _session_id, _function_name, _players, _sockets) {
    this.io = _io;
    this.session_id = _session_id;
    this.function_name = _function_name;
    this.players = _players;
    this.sockets = _sockets;
    this.status_code = "";
    this.startTimeDate = "";
    this.endTimeDate = "";
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
      if (!p_status) {
        status = false;
      }
    }
    if (status) {
      this.prestart();
    }
  }

  prestart() {
    this.sendPayload({ "type":"SESSION_PRESTART", "function_name":this.function_name, "session_id": this.session_id});
  }

  sendPayload(data) {
    for (var i = 0; i < this.players.length; i++) {
      this.sockets[this.players[i].player].emit(this.players[i].player, data);
    }
  }

  sendFrame(data) {
    for (var i = 0; i < this.players.length; i++) {
      var player = this.players[i].player;
      var socket = this.sockets[player];

      if (player !== data['rand_user']) {
        socket.emit(this.function_name,data.user['payload']);
      }
      //this.sockets[player].emit(this.function_name,data.user['payload']);
    }
  }

  completedRound(data) {
    //console.log("completedRound");
    var rand_user = data['rand_user'];
    var status = true;
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) {
        this.players[i].finished = true;
      }
    }
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].finished;
      if (!p_status) {
        status = false;
      }
    }
    if (status) {
      this.gameover();
    }
  }

  sessionPrestartConfirm(data) {
    //console.log("sessionPrestartConfirm");
    var rand_user = data['rand_user'];
    var status = true;
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) {
        this.players[i].prestart = true;
      }
    }
    for (var i = 0; i < this.players.length; i++) {
      var p_status = this.players[i].prestart;
      if (!p_status) {
        status = false;
      }
    }
    if (status) {
      this.sendPayload({ "type":"SESSION_COUNTDOWN_START" });
      this.time_count = 0;
      this.time_limit = 10;
      var self = this;
      this.timer = setInterval(function(){
        console.log("intervaling...");
        if (self.time_limit === self.time_count) {
          self.stopCountDown();
        } else {
          var count = self.time_limit - self.time_count;
          console.log("Count -> ",(self.time_limit - self.time_count));
          self.sendPayload({ "type":"SESSION_COUNTDOWN_INTERVAL", "count":count  });
          self.time_count++;
        }
      }, 1000);
    }
  }

  stopCountDown() {
    clearInterval(this.timer);
    this.sendPayload({ "type":"SESSION_GO" });
  }

  gameover() {
    this.sendPayload({ "type":"SESSION__OVERVIEW", "session_id": this.session_id, "players": []});
  }

  countDown() {

  }

  release() {
    this.sendPayload({ "type":"JOIN_SESSION_FOUND", "function_name":this.function_name, "session_id": this.session_id});
  }

  playerReady(data) {
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) {
        this.players[i].ready = true;
      }
    }
    this.sendPayload({ "type":"SESSION_PLAYER_READY", "rand_user":rand_user });
    this.checkIsReady();
  }

  playerNotReady(data) {
    var rand_user = data['rand_user'];
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i].player == rand_user) {
        this.players[i].ready = false;
      }
    }
    this.sendPayload({ "type":"SESSION_PLAYER_NOT_READY", "rand_user":rand_user });
    this.checkIsReady();
  }

  closeSession() {

  }

}
