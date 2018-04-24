import configs from '../configs';
import status from '../system_status';
import users from '../models/user';

const TOKEN_SECRET = configs.token.secret;

module.exports = function (app, route, jwt) {
    // middleware to confirm the token in the header is valid for payload
    route.use(function(req, res, next) {
        var token = req.headers && req.headers.authorization ? req.headers.authorization.split(' ')[1] : '';
        if (token) {
            jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
                if (err) { return res.json({ error: err, message: status.TOEKN_AUTHENTICATION_FAILED });
                } else {
                    // populates the reqs with user profile
                    users.findById(decoded.id).select('username firstName lastName email id').exec(function(err, usr) {
                        req.user = usr;
                        next();
                    });
                }
            });
        } else {
            //403 Forbidden when the token cannot be verify
            return403();
        }
        // responds with a (403 Forbidden)
        function return403() {
            res.status(403).send({ error: status.TOKEN_FAILED_MESSAGE, message: status.TOKEN_FAILED });
        }
    });
}
