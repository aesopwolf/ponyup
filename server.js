var express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    RedisStore = require('connect-redis')(session),
    bodyParser = require('body-parser'),
    request = require('request'),
    fs = require('fs'),
    nconf = require('nconf'),
    _ = require('underscore'),
    bcrypt = require('bcrypt'),
    cache = require('memory-cache'),
    csrf = require('csurf');

var app = express();

// load keys/secrets/salts/etc into app
nconf.argv().file({file: 'config.json'}).env();
_.each(nconf.get(), function(value, key, list) {
  app.set(key, value.toString());
});

// middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  store: new RedisStore({
    host:  app.get('Redis-Host'),
    pass:  app.get('Redis-Pass'),
    port: app.get('Redis-Port')
  }),
  name: 'ponyup.session',
  secret: app.get('Express-Session-Secret'),
  cookie: { path: '/', httpOnly: true, secure: false, maxAge: null },
  resave: true,
  saveUninitialized: true,
  rolling: true
}));
// app.use(csrf({
//   cookie: {
//     key: 'ponyup.csrf'
//   }
// }));

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
  console.log(req.session);
  req.body = removeEmptyItems(req.body);

  // save listing to parse
  request.post({
    json: req.body,
    url: 'https://api.parse.com/1/classes/Ledger',
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  },
  function(error, message, body) {
    // finally send the data to client
    res.send(body);

    // generate secret access key
    bcrypt.hash(body.objectId, 8, function(err, hash) {
      // save a secret access key
      request.put({
        json: {secretKey: hash},
        url: 'https://api.parse.com/1/classes/Ledger/' + body.objectId,
        headers: {
          'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
          'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
        },
        strictSSL: true,
        gzip: true
      },
      function(error, message, bodyNew) {
        // insert body.objectId into user session?
      });
    });
  })
});

// READ LEDGER
app.get('/api/ledger/:id', function(req, res) {
  request.get({
    url: 'https://api.parse.com/1/classes/Ledger/' + req.params.id,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    body = JSON.parse(body);
    body.name = body.name ? body.name : '(empty)';
    body.contributions = [];
    body.secretKey = undefined;
    body.admin = undefined;

    // save to cache (used late for creating user sessions in a faster manner)
    cache.put(body.objectId, body);

    // does this session have admin access?
    if(_.indexOf(req.session.ledgers, req.params.id) >= 0) {
      console.log(req.session);
      body.admin = true;
    }

    res.send(body);
  })
});

// UPDATE LEDGER
app.post('/api/ledger/update', function(req, res) {
  /* CREATE USER SESSION IF SOMEONE IS CLAIMING THE LISTING */
  var isNowAdmin = false;
  // todo: this cache isn't stateless. need to move to mongo or something
  if(req.body.missingEmail && !cache.get(req.body.objectId).email) {
    // extend the session for one month
    var hour = 3600000
    req.session.cookie.maxAge = hour * 24 * 30;

    // save ledger id to session
    req.session.ledgers = req.session.ledgers ? req.session.ledgers : [];
    req.session.ledgers.push(req.body.objectId);
    isNowAdmin = true;
  }

  // Authentication check
  if(_.indexOf(req.session.ledgers, req.body.objectId) < 0) {
    res.json({status: 'error', message: 'You don\'t have access to update this listing!'});
    return;
  }
  else if(_.indexOf(req.session.ledgers, req.body.objectId) > 0){
    var wasAlreadyAdmin = true;
  }

  /* CLEAN UP INCOMING DATA */
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
    url: 'https://api.parse.com/1/classes/Ledger/' + req.body.objectId,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    if(body.updatedAt) {
      // add an admin key if they are the owner
      if(isNowAdmin || wasAlreadyAdmin || req.body.admin) {
        req.body.admin = true;
      }
      res.send(req.body);
    }
    else {
      req.body.status = "error";
      res.send(req.body);
    }
  });
});

// CHARGE CARD
app.post('/api/charge', function(req, res) {
  stripe = require('stripe')(app.get('Stripe-Secret-Key'));

  var charge = stripe.charges.create({
    amount: req.body.amount,
    currency: 'usd',
    card: req.body.id,
    description: 'https:/www.ponyup.io/' + req.body.objectId,
    metadata: {
      customerEmail: req.body.email
    },
    statement_description: '.io/' + req.body.objectId,
    receipt_email: req.body.email
  }, function(err, charge) {
    if (err && err.type === 'StripeCardError') {
      // The card has been declined
      res.json({status: 'error', message: err});
    }
    else {
      // add some extra meta info
      charge.chargeId = charge.id;
      charge.ledgerId = req.body.objectId;

      // save charge to parse
      request.post({
        json: charge,
        url: 'https://api.parse.com/1/classes/Charge',
        headers: {
          'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
          'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
        },
        strictSSL: true,
        gzip: true
      }, function(error, message, body) {
        // send the user the response
        res.json({status: 'success', message: charge});
      })
    }
  });
});

// GET PAYMENTS FOR A PARTICULAR LEDGER
app.get('/api/ledger/:id/charges', function(req, res) {
  var query = encodeURI('where={\'ledgerId\': ' + req.params.id + '}');
  request.get({
    url: 'https://api.parse.com/1/classes/Charge?' + query,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    var bodyObject = JSON.parse(body);

    // select only certain fields to make public
    var filteredCharges = [];
    _.each(bodyObject.results, function(element, index, list) {
      element.cardBrand = element.card.type;
      element = _.pick(element, [
        'cardBrand',
        'amount',
        'created'
      ]);
      filteredCharges.push(element);
    });

    // send it off
    res.json({results: filteredCharges});
  })
});

app.post('/api/logout', function(req, res) {
  req.session.destroy(function(err) {
    if(!err) {
      res.json({status: 'success', message: 'Thanks for using PonyUp!'});
    }
    else {
      res.json({status: 'error', message: 'We had trouble logging you out'});
    }
  });
});

app.get('*', function(req, res) {
  // send single page app
  res.sendFile('index.html', {'root': 'public'});
})

app.listen(8080);