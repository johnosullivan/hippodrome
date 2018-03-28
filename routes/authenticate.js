import bcrypt from 'bcrypt-nodejs';
import users from '../models/User';
import status from '../system_status';
import configs from '../configs';
// jwt variables needed for authenticate tokens.
const TOKEN_SECRET = configs.token.secret;
const TOKEN_EXPIRES = parseInt(configs.token.expiresInSeconds, 10);

module.exports = function(app, route, jwt) {
  /*
   * @description -> The route for the the registration route
   * @req.body params required -> email, username, password, firstName, lastName
   */
  route.post('/auth/registration', function(req, res) {
    // Will see if the user exists with the username
    users.findOne({
      username: req.body.username
    }, function handleQuery(error, user) {
      // If node.js cannot access mongodb returns internal error.
      if (error) {
        res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
        return;
      }
      // If username exists will throw a error that username exists.
      if (user) {
        res.status(500).json({ success: false, message: status.USERNAME_EXISTS });
        return;
      }
      // Generates a salt
      bcrypt.genSalt(10, function(error, salt) {
        // Throw error if the salt generation fails.
        if (error) {
          res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
          return;
        }
        // Hashes the password
        bcrypt.hash(req.body.password, salt, null, function(error, hash) {
          // Throws if the hash of the password fails.
          if (error) {
            res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
            throw error;
          }
          // Constructs the user model object.
          var user = new users(req.body);
          user.password = hash;
          // Saves the user object to mongodb.
          user.save(function(error) {
            // Throws if the saving fails.
            if (error) {
              res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
              throw error;
            }
            // Response with new user profile.
            res.json({
              success: true,
              user: {
                firstName: user.firstName, lastName: user.lastName,
                username: user.username, id: user.id, email: user.email
              }
            }); // response
          }); // save
        }); // hashing
      }); // generate salt
    }); // findOne
  }); // registration

  /*
   * @description -> The route for the the login route
   * @req.body params required -> username, password
   */
  route.post('/auth/authenticate', function(req, res) {
    users.findOne({ username: req.body.username }, function handleQuery(error, user) {
      // If node.js cannot access mongodb returns internal error.
        if (error) {
          res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
          throw error;
        }
        // Authorization has failed and error will be sent.
        if (!user) {
          res.status(401).json({ success: false, message: status.AUTHENTICATION_FAILED });
          return;
        }
        bcrypt.compare(req.body.password, user.password, function (error, result) {
          // If bcrypt fails to compare it returns internal error.
          if (error) {
            res.status(500).json({ success: false, message: status.INTERNAL_SERVER_ERROR });
            throw error;
          }
          // Authorization has failed and error will be sent.
          if (!result) {
            res.status(401).json({ success: false, message: status.AUTHENTICATION_FAILED });
            return;
          }
          // Creates a token that can be used for interacting with the API
          var token = jwt.sign({ username: user.username }, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRES });
          res.json({ success: true, token: token, user: { username:user.username, firstName:user.firstName, lastName:user.lastName, id:user.id, email:user.email } });
        });
      });
  });
};
