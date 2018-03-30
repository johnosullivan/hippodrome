import random from "random-id";
import PubSub from 'pubsub-js';

module.exports = function(app, route, jwt, socket, readyForSession) {
  /*
   * @description -> The route for the the readyForSession route
   */
  route.get('/readyForSession', function(req, res) {
    var rand_user = random(50,"aA0");
    PubSub.publish('readyForSession', { 'user': req.user, 'rand_user': rand_user });
    res.json({
      rand_user: rand_user
    });
  });
  /*
   * @description -> The route for the the exitSessionQuene route
   */
  route.get('/exitSessionQuene', function(req, res) {
    PubSub.publish('exitSessionQuene', { 'user': req.user });
    res.json({
      success: true
    });
  });
};
