// feed.js
// Feed model logic.

var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');
var User = require('./user.js');
var Event = require('./event.js');

var Feed = module.exports = function Feed(){};


Feed.prototype.getFeed = function (callback) {
    var query = [
        'START user=node(*)',
        'MATCH (user)-[rel]-> other',
        'RETURN user, other, type(rel) as type',  
        'ORDER BY rel.date DESC'  
    ].join('\n');

    var items = [];
    var others = [];
    var reltypes = [];

    db.query(query, {}, function (err, results) {
		if (err) return callback(err);
        for (var i = 0; i < results.length; i++) {
    		switch(results[i]['type']){
    			case "follows":
    				var user = new User(results[i]['user']);
    				var other = new User(results[i]['other']);
    			break;
    			case "pledge":
    				var user = new User(results[i]['user']);
    				var other = new Event(results[i]['other']);
    			break; 			
    		}
    		users.push(user);
    		others.push(other);
    		reltypes.push(results[i]['type']);
		}
        callback(null, others, users, reltypes);
	});
};