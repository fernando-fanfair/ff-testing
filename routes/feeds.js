var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');
var User = require('../models/user.js');
var Event = require('../models/event.js');


exports.show = function (req, res, next) {
    var query = [
        'START user=node(*)',
        'MATCH (user)-[rel]-> other',
        'RETURN user, other, type(rel) as type',  
        'ORDER BY rel.date DESC'  
    ].join('\n');

    var users = [];
    var others = [];
    var reltypes = [];

    db.query(query, {}, function (err, results) {
        if (err) return next(err);
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
        res.render('feed', {
            others: others,
            users: users,
            reltypes: reltypes
        });
    });
};

exports.showsByUser = function (req, res, next) {
    var query = [
        'START user=node({userId})',
        'MATCH (user)-[rel]-> other',
        'RETURN user, other, type(rel) as type',  
        'ORDER BY rel.date DESC'  
    ].join('\n');
    var userid = parseInt(req.params.id);
    var params = {
        userId: userid
    };


    var users = [];
    var others = [];
    var reltypes = [];

    db.query(query, params, function (err, results) {
        if (err) return next(err);
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
        res.render('feed', {
            others: others,
            users: users,
            reltypes: reltypes
        });
    });
};