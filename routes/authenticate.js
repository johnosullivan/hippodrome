module.exports = function(app, route, jwt, socket) {
  route.get('/getToken/:data', function(req, res) {
    var token = jwt.sign({ data: req.params.data }, app.get('jwt_secret'), { expiresIn: '1d' });
    res.json({
      data: token
    });
  });
};
