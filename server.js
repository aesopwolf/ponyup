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
var removeEmptyItems = function(o) {
  if(o) {
    for(var i = 0; i < o.items.length; i++) {
      if(!o.items[i].description && !o.items[i].price) {
        o.items.splice(i, 1);
        i--;
      }
    }
  }
  return o;
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
  req.body.description = req.body.descriptionNew ? req.body.descriptionNew : undefined;
  req.body.descriptionNew = undefined;

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