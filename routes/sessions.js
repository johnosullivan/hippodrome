module.exports = function(app, route, jwt, socket) {
  route.get('/readyForSession', function(req, res) {
    console.log("user: ", req.user);

    res.json({
      data: 'ping'
    });

  });
};
