// event.js
// Event model logic.

var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');
var User = require('./user.js');

var INDEX_NAME = 'nodes';
var INDEX_KEY = 'type';
var INDEX_VAL = 'event';

var PLEDGE_REL = 'pledge';

var Event = module.exports = function Event(_node) {
    this._node = _node;
 }

// pass-through node properties:

function proxyProperty(prop, isData) {
    Object.defineProperty(Event.prototype, prop, {
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
proxyProperty('name', true);
proxyProperty('desc',true);



Event.prototype.getPledgesAndOthers = function (callback) {
    // query all users and whether we follow each one or not:
    var query = [
        'START event=node({eventId}), users=node:nodes(type="user")',
        'MATCH (event)<-[rel?:PLEDGE_REL]-> (users)',
        'RETURN users, COUNT(rel)'  // COUNT(rel) is a hack for 1 or 0
    ].join('\n')
        .replace('INDEX_NAME', INDEX_NAME)
        .replace('INDEX_KEY', INDEX_KEY)
        .replace('INDEX_VAL', INDEX_VAL)
        .replace('PLEDGE_REL', PLEDGE_REL);

    var params = {
        eventId: this.id,
    };

    var vEvent = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);

        var pledged = [];
        var others = [];
        for (var i = 0; i < results.length; i++) {

            var other = new Event(results[i]['users']);
            var ifPledge = results[i]['COUNT(rel)'];

			if (ifPledge) {
				//console.log(results[i]['users']);
                pledged.push(other);
            } else {
                others.push(other);
            }
        }

        callback(null, pledged, others);
    });
};

Event.prototype.pledge = function (other, callback) {
    other._node.createRelationshipTo(this._node, 'pledge', {'date': new Date()}, function (err, rel) {
        callback(err);
    });
};

Event.prototype.getCommonPledges = function (userid,callback){

    var query = [
        'START event=node({eventId}),user=node({userId})',
        'MATCH user-[:follows]-friend-[:pledge]-> event',
        'RETURN distinct friend'
    ].join('\n');

    var params = {
        eventId: this.id,
        userId: parseInt(userid),
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);  
        var following = [];    
        for (var i = 0; i < results.length; i++){

            //console.log(results[i]['friend']);
            following.push(new User(results[i]['friend']));
        }

        callback(null, following);
    });


};
/*-------------------------------------------------------------*/

Event.get = function (id, callback) {
    db.getNodeById(id, function (err, node) {
        if (err) return callback(err);
        callback(null, new Event(node));
    });
};


Event.getAll = function (callback) {
    db.getIndexedNodes(INDEX_NAME, INDEX_KEY, INDEX_VAL, function (err, nodes) {
        // if (err) return callback(err);
        // XXX FIXME the index might not exist in the beginning, so special-case
        // this error detection. warning: this is super brittle!!
        if (err) return callback(null, []);
        var events = nodes.map(function (node) {
            return new Event(node);
        });
        callback(null, events);
    });
};


Event.create = function (data, callback) {
    //console.log(data);
    var node = db.createNode(data);
    var nodeEvent = new Event(node);
    node.save(function (err) {
        if (err) return callback(err);
        node.index(INDEX_NAME, INDEX_KEY, INDEX_VAL, function (err) {
            if (err) return callback(err);
            callback(null, nodeEvent);
        });
    })
;};
