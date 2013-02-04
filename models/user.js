// user.js
// User model logic.

var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');
var Event = require('./event.js');

// constants:

var INDEX_NAME = 'nodes';
var INDEX_KEY = 'type';
var INDEX_VAL = 'user';

var FOLLOWS_REL = 'follows';

// private constructor:

var User = module.exports = function User(_node) {
    // all we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
}

// pass-through node properties:

function proxyProperty(prop, isData) {
    Object.defineProperty(User.prototype, prop, {
        get: function () {
            if (isData) {
                return this._node.data[prop];
            } else {
                return this._node[prop];
            }
        },
        set: function (value) {
            if (isData) {
                this._node.data[prop] = value;
            } else {
                this._node[prop] = value;
            }
        }
    });
}

proxyProperty('id');
proxyProperty('exists');
proxyProperty('friend', true);
proxyProperty('name', true);

// private instance methods:

User.prototype._getFollowingRel = function (other, callback) {
    var query = [
        'START user=node({userId}), other=node({otherId})',
        'MATCH (user) -[rel?:FOLLOWS_REL]-> (other)',
        'RETURN rel'
    ].join('\n')
        .replace('FOLLOWS_REL', FOLLOWS_REL);

    var params = {
        userId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        var rel = results[0] && results[0]['rel'];
        callback(null, rel);
    });
};

// public instance methods:

User.prototype.save = function (callback) {
    this._node.save(function (err) {
        callback(err);
    });
};

User.prototype.del = function (callback) {
    this._node.del(function (err) {
        callback(err);
    }, true);   // true = yes, force it (delete all relationships)
};

User.prototype.follow = function (other, callback) {
    this._node.createRelationshipTo(other._node, 'follows', {'date': new Date()}, function (err, rel) {
        callback(err);
    });
};

User.prototype.unfollow = function (other, callback) {
    this._getFollowingRel(other, function (err, rel) {
        if (err) return callback(err);
        if (!rel) return callback(null);
        rel.del(function (err) {
            callback(err);
        });
    });
};

/*User.prototype.getPledges = function (callback) {
    var query = [
        'START user=node({userId})',
        'MATCH user-[:pledge]->event',
        'RETURN event'
    ].join('\n');

    var params = {
        userId: this.id,
    };
    pledges = [];
    db.query(query, params, function (err, results) {
        if (err) return callback(err);     
        for (var i = 0; i < results.length; i++) {
            pledge = new Event(results[i]['event']);
            pledges.push(pledge);
       }
        callback(null, pledges);
    });

};*/  
User.prototype.getPledges = function (callback) {
    var query = [
        'START user=node({userId})',
        'MATCH user-[rel?:follows]->friend-[?:pledge]-> event, user-[:pledge]-> event',
        'WHERE not(user = friend) and friend-[:pledge]-> event',
        'RETURN distinct event, friend, count(rel) as related',
        'ORDER BY event.name'
    ].join('\n');

    var params = {
        userId: this.id
    };

    var pledges = [];
    var following = [];
    var otherspledging = [];
    var pastEventID = 0;
    var friend = new Array();
    var others = new Array();
    var c=0;
    var k=0;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);     
        if (results.length > 0){
            for (var i = 0; i < results.length; i++) {
                pledge = new Event(results[i]['event']);
                var follows = results[i]['related'];
                if (pastEventID != pledge.id){
                    if (friend.length == 0  && pastEventID != 0){
                        following.push(friend);
                    }else if(friend.length >0){  
                        following.push(friend);
                        friend = new Array();
                        c=0;
                   }
                    if (others.length == 0  && pastEventID != 0){
                        otherspledging.push(others);
                        others = new Array();

                    }else if(others.length >0){  
                        otherspledging.push(others);
                        others = new Array();
                        k=0;
    
                   }
                    if (follows == 1){
                       friend[c] = new User(results[i]['friend']);
                       c++;
                    }else if(results[i]['friend'] != null){
                        others[k] = new User(results[i]['friend']);
                        k++;
                    }

                    pastEventID = pledge.id;
                    pledges.push(pledge);

                }else{

                    if (follows == 1){

                       friend[c] = new User(results[i]['friend']);
                       c++;

                    }else if(results[i]['friend'] != null){

                        others[k] = new User(results[i]['friend']);
                        k++;

                    }
                }

            }

            following.push(friend);
            otherspledging.push(others);
        }
        callback(null, pledges, following,otherspledging);
    });

};  
// calls callback w/ (err, following, others) where following is an array of
// users this user follows, and others is all other users minus him/herself.
User.prototype.getFollowingAndOthers = function (callback) {
    // query all users and whether we follow each one or not:
    var query = [
        'START user=node({userId}), other=node:INDEX_NAME(INDEX_KEY="INDEX_VAL")',
        'MATCH (user) -[rel?:FOLLOWS_REL]-> (other)',
        'RETURN other, COUNT(rel)'  // COUNT(rel) is a hack for 1 or 0
    ].join('\n')
        .replace('INDEX_NAME', INDEX_NAME)
        .replace('INDEX_KEY', INDEX_KEY)
        .replace('INDEX_VAL', INDEX_VAL)
        .replace('FOLLOWS_REL', FOLLOWS_REL);

    var params = {
        userId: this.id,
    };

    var user = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);

        var following = [];
        var others = [];

        for (var i = 0; i < results.length; i++) {
            var other = new User(results[i]['other']);
            var follows = results[i]['COUNT(rel)'];

            if (user.id === other.id) {
                continue;
            } else if (follows) {
                following.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, following, others);
    });
};

// static methods:

User.get = function (id, callback) {
    db.getNodeById(id, function (err, node) {
        if (err) return callback(err);
        callback(null, new User(node));
    });
};

User.getAll = function (callback) {
    db.getIndexedNodes(INDEX_NAME, INDEX_KEY, INDEX_VAL, function (err, nodes) {
        // if (err) return callback(err);
        // XXX FIXME the index might not exist in the beginning, so special-case
        // this error detection. warning: this is super brittle!!
        if (err) return callback(null, []);
        var users = nodes.map(function (node) {
            return new User(node);
        });
        callback(null, users);
    });
};

// creates the user and persists (saves) it to the db, incl. indexing it:
User.create = function (data, callback) {
    //console.log(data);
    var node = db.createNode(data);
    var user = new User(node);
    node.save(function (err) {
        if (err) return callback(err);
        node.index(INDEX_NAME, INDEX_KEY, INDEX_VAL, function (err) {
            if (err) return callback(err);
            callback(null, user);
        });
    });
};
