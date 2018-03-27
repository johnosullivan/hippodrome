module.exports = function(app, route, jwt, socket) {
  route.get('/ping', function(req, res) {
    res.json({
      data: 'ping'
    });
  });
};
