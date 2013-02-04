var neo4j = require('neo4j');
var db = new neo4j.GraphDatabase(process.env.NEO4J_URL || 'http://localhost:7474');

var Event = require('../models/event');
var User = require('../models/user');


exports.addEvent = function(req, res, next){
    Event.create({
        name: req.body['name'],
        desc: req.body['desc']
    }, function (err, user) {
        if (err) return next(err);
        res.redirect('/events/' + user.id);
    });

};

exports.getList = function(req, res, next){
    Event.getAll(function (err, events) {
        if (err) return next(err);
        res.render('events', {
            events: events
        });
    });
};

exports.getEvent = function (req, res, next) {
    Event.get(req.params.id, function (err, event) {
        if (err) return next(err);
	        event.getPledgesAndOthers(function (err, pledged, others) {
				if (err) return next(err);
				//console.log(pledged);
                res.render('event', {
	                event: event,
	                pledged: pledged,
	                others: others
		        });
	        });
    });
};

exports.pledge = function (req, res, next) {
    Event.get(req.params.id, function (err, event) {
        if (err) return next(err);
        Event.get(req.body.event.id, function (err, other) {
            if (err) return next(err);
            event.pledge(other, function (err) {
                if (err) return next(err);
                res.redirect('/events/' + event.id);
            });
        });
    });
};
