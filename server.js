var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    fs = require('fs'),
    nconf = require('nconf'),
    _ = require('underscore');

var app = express();

// middleware
app.use(express.static('public'));
app.use(bodyParser.json());

// load keys/secrets/salts/etc into app
nconf.argv().file({file: 'config.json'}).env();
_.each(nconf.get(), function(value, key, list) {
  app.set(key, value.toString());
});

// helper functions
var removeEmptyItems = function(object) {
  if(object) {
    for(var i = 0; i < object.items.length; i++) {
      if(!object.items[i].description && !object.items[i].price) {
        object.items.splice(i, 1);
        i--;
      }
    }
  }
  return object;
}

// CREATE LEDGER
app.post('/api/ledger', function(req, res) {
  req.body = removeEmptyItems(req.body);

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

// READ LEADER
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
    body = JSON.parse(body);
    body.name = body.name ? body.name : "(empty)";
    res.send(body);
  })
});

// UPDATE LEDGER
app.post('/api/ledger/update', function(req, res) {
  req.body = removeEmptyItems(req.body);

  // add/remove email keys accordingly
  req.body.email = req.body.missingEmail ? req.body.missingEmail : req.body.email;
  req.body.missingEmail = undefined;

  // rename description field
  req.body.description = req.body.descriptionNew ? req.body.descriptionNew : req.body.description;
  req.body.descriptionNew = undefined;

  // we don't need to save the amount the user is paying into the Ledger class
  req.body.dollarAmount = undefined;

  // make email lower case (for gravater)
  req.body.email = req.body.email.toLowerCase();

  request.put({
    json: req.body,
    url: "https://api.parse.com/1/classes/Ledger/" + req.body.objectId,
    headers: {
      "X-Parse-Application-Id": app.get("X-Parse-Application-Id"),
      "X-Parse-REST-API-Key": app.get("X-Parse-REST-API-Key")
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    if(body.updatedAt) {
      res.send(req.body);
    }
    else {
      req.body.status = "error";
      res.send(req.body);
    }
  })
});

app.get('*', function(req, res) {
  res.sendFile('index.html', {'root': 'public'});
})

app.listen(8080);