'use strict';

module.exports = class Session {

  constructor(_session_id) {
    this.session_id = _session_id;
    console.log(this.session_id);
  }

}
