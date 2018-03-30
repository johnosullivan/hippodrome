'use strict';

module.exports = class session {

  constructor(_session_id, _players) {
    this.session_id = _session_id;
    this.players = _players;
    console.log(this.session_id);
  }

  kill() {

  }

}
