import PubSub from 'pubsub-js';

module.exports = class dispatcher {

  constructor(_io) {
    // sets the dispatcher controllers variables
    this.io = _io;
    this.readyForSession = {};
    this.interval_object = {};

    var self = this;
    var readyForSession_func = function (event_name, data) {
      //console.log(event_name, data);
      self.readyForSession[data.user['_id']] = data.rand_user;
    };

    var exitSessionQuene_func = function (event_name, data) {
      //console.log(event_name, data);
      delete self.readyForSession[data.user['_id']];
    };

    this.readyForSession_pubsub = PubSub.subscribe('readyForSession', readyForSession_func);
    this.exitSessionQuene_pubsub = PubSub.subscribe('exitSessionQuene', exitSessionQuene_func);
  }

  loop() {

  }

  start() {
    var self = this;
    this.interval_object = setInterval(function() { self.loop() }, 1000);
  }

  kill() {
    clearInterval(this.interval_object);
  }

}
