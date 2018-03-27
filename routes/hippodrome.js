module.exports = function(app, apiRoutes, jwt, socket, express) {
  app.use('/hippodrome', express.static('status.html'));
};
