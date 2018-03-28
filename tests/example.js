var randomID = require("random-id");
var Session = require("../lib/Session");

var session_id = randomID(50,"aA0");
var temp = new Session(session_id);
