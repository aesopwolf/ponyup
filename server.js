var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    fs = require('fs'),
    nconf = require('nconf'),
    _ = require('underscore');

var app = express();

app.use(express.static('public'));
app.use(bodyParser.json());

nconf.argv().file({file: 'config.json'}).env();

_.each(nconf.get(), function(value, key, list) {
  app.set(key, value.toString());
});

// CREATE
app.post('/api/ledger', function(req, res) {
  if(req.body) {
    for(var i = 0; i < req.body.items.length; i++) {
      if(!req.body.items[i].description && !req.body.items[i].price) {
        req.body.items.splice(i, 1);
        i--;
      }
    }
  }

  request.post({
    json: req.body,
    url: "https://api.parse.com/1/classes/Ledger",
    headers: {
      "X-Parse-Application-Id": app.get("X-Parse-Application-Id"),
      "X-Parse-REST-API-Key": app.get("X-Parse-REST-API-Key")
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    res.send(body);
  })
});

// READ
app.get('/api/ledger/:id', function(req, res) {
  request.get({
    url: "https://api.parse.com/1/classes/Ledger/" + req.params.id,
    headers: {
      "X-Parse-Application-Id": app.get("X-Parse-Application-Id"),
      "X-Parse-REST-API-Key": app.get("X-Parse-REST-API-Key")
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    res.send(body);
  })
});

app.get('*', function(req, res) {
  res.sendFile('index.html', {'root': 'public'});
})

app.listen(8080);