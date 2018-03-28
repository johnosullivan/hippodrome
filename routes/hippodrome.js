module.exports = function(app, route, jwt, socket, express, sessions) {
  app.use('/hippodrome', express.static('status.html'));
  route.get('/sessions', function(req, res) {
    res.json(sessions);
  });
};
