module.exports = function (app, route, jwt) {
    // middleware to confirm the token in the header is valid for payload
    route.use(function(req, res, next) {
        var token = req.headers && req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
        if (token) {
            jwt.verify(token, app.get('jwt_secret'), function(err, decoded) {
                if (err) { return res.json({ error: err, message: 'Failed to authenticate token.' });
                } else {
                    console.log(decoded)
                    next();
                }
            });
        } else {
            //403 Forbidden when the token cannot be verify
            return403();
        }
        // responds with a (403 Forbidden)
        function return403() {
            res.status(403).send({ error: 'Token missing or not registered to your user.', message: 'No token provided.'});
        }
    });
}
