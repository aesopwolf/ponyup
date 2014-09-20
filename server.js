var express = require('express'),
    http = require('http'),
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
    csrf = require('csurf'),
    mandrill = require('mandrill-api/mandrill'),
    winston = require('winston'),
    Papertrail = require('winston-papertrail').Papertrail;

var app = express();

/*
CONFIGURATION
=================================================
*/

// load keys/secrets/salts/etc into app
var configuration = process.env.NODE_ENV === 'production' ? 'config-production.json' : 'config-staging.json';
nconf.argv().file({file: configuration}).env();
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
// todo: setup csrf
// app.use(csrf({
//   cookie: {
//     key: 'ponyup.csrf'
//   }
// }));

// mandrill is our smtp service for transactional emails
var mandrill_client = new mandrill.Mandrill(app.get('Mandrill-Key'));

// create logging transports
var consoleLogger = new winston.transports.Console({
  colorize: true,
  handleExceptions: true
});
var paperTrailLogger = new Papertrail({
  host: app.get('Papertrail-Host'),
  port: app.get('Papertrail-Port'),
  colorize: true,
  handleExceptions: true,
  json: true
});

// define logging per environment
var newTransports = [];
if(app.get('NODE_ENV') !== 'production') {
  newtransports = [consoleLogger];
}
else {
  newtransports = [consoleLogger,paperTrailLogger];
}

// create the logging system
var logger = new (winston.Logger)({
  transports: newtransports,
  exitOnError: true,
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }
});

// papertrail event emitters (incase Papertrail goes crazy)
paperTrailLogger.on('error', function(err) {
  logger.error(err);
});

/*
HELPER FUNCTIONS
=================================================
*/
// remove line items that are missing the description and price
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

// send a special authentication link via email
var sendAdminLink = function (email, id) {
  request.get({
    url: 'https://api.parse.com/1/classes/Ledgers/' + id,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    body = JSON.parse(body);

    // generate email body
    var htmlBody = '';
    htmlBody += "<p><strong>Keep this link private</strong>. Anyone who get's access to this link can edit your listing!";
    htmlBody += '<p><a href="https://ponyup.localtunnel.me/' + id + "/authorize?secret=" + encodeURI(body.secretKey) + '">Click here to access the admin panel</a></p>';
    htmlBody += '<p><small>(This is also where you can enter your bank info so we can pay you.)</small></p>';
    htmlBody += "<hr><p>" + body.name + "</p>";

    // generate table of line items
    var htmlItems = '<table>';
    _.each(body.items, function(element, index, list) {
      htmlItems += "<tr><td>" + element.description + "</td><td>$" + element.price + "</td></tr>";
    });
    htmlItems += "</table>";
    htmlBody += htmlItems;

    var message = {
      "html": htmlBody,
      "subject": "PonyUp Listing",
      "from_email": "yourfriends@ponyup.io",
      "from_name": "PonyUp",
      "to": [{
          "email": email,
          "type": "to"
      }],
      "tags": [
          "claim-ownership"
      ],
    };
    var async = false;
    mandrill_client.messages.send({"message": message, "async": async}, function(result) {
      // console.log(result);
    }, function(e) {
      logger.error(e);
    });
  })
};

var getRemainingBalance = function(ledgerId, cb) {
  var totalContributionsWithFee = 0;
  var totalPayouts = 0;

  // get the contributions made so far
  var query = encodeURI('where={"ledgerId": "' + ledgerId + '"}');
  request.get({
    url: 'https://api.parse.com/1/classes/Charges?' + query,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    body = JSON.parse(body);
    _.each(body.results, function(element, index, list) {
      totalContributionsWithFee += (element.amount * 0.97) - 30;
    });

    // CALLBACK HELL:

    // get the payouts made so far
    var query = encodeURI('where={"metadata.ledgerId": "' + ledgerId + '"}');
    request.get({
      url: 'https://api.parse.com/1/classes/Transfers?' + query,
      headers: {
        'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
        'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
      },
      strictSSL: true,
      gzip: true
    }, function(error, message, body) {
      body = JSON.parse(body);
      _.each(body.results, function(element, index, list) {
        totalPayouts += element.amount;
      });

      // return totalContributionsWithFee - totalPayouts - 25;
      cb(totalContributionsWithFee - totalPayouts - 25);
    });
  });
};

/*
ROUTES
=================================================
*/

// CREATE LEDGER
app.post('/api/ledger', function(req, res) {
  req.body = removeEmptyItems(req.body);

  // save listing to parse
  request.post({
    json: req.body,
    url: 'https://api.parse.com/1/classes/Ledgers',
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
        url: 'https://api.parse.com/1/classes/Ledgers/' + body.objectId,
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
  if(cache.get(req.params.id)) {
    var body = cache.get(req.params.id);
    // does this session have admin access?
    if(_.indexOf(req.session.ledgers, req.params.id) >= 0) {
      body.admin = true;
    }
    else {
      body.admin = undefined;
    }
    res.send(body);
    return;
  }
  request.get({
    url: 'https://api.parse.com/1/classes/Ledgers/' + req.params.id,
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


    // does this session have admin access?
    if(_.indexOf(req.session.ledgers, req.params.id) >= 0) {
      // don't attach admin access to cache
      var bodyCache = body;
      bodyCache.admin = undefined;
      cache.put(body.objectId, bodyCache);

      // attach admin access to the output though
      body.admin = true;
    }
    else {
      cache.put(body.objectId, body);
    }

    res.send(body);
  })
});

// UPDATE LEDGER
// todo: deconstruct this block and make it less complex
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

    // send email with admin token for later access
    sendAdminLink(req.body.missingEmail, req.body.objectId);
  }

  // Check if user has access to update the rest of the listing
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

  // we don't need to save the amount the user is paying into the Ledgers class
  req.body.dollarAmount = undefined;

  // make email lower case (for gravater)
  req.body.email = req.body.email.toLowerCase();

  request.put({
    json: req.body,
    url: 'https://api.parse.com/1/classes/Ledgers/' + req.body.objectId,
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
      cache.put(req.body.objectId, req.body);
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
        url: 'https://api.parse.com/1/classes/Charges',
        headers: {
          'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
          'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
        },
        strictSSL: true,
        gzip: true
      }, function(error, message, body) {
        // send the user the response
        res.json({status: 'success', message: charge});

        // todo: send email to user with current 'name', 'description', and 'items'
      })
    }
  });
});

// START THE DEPOSIT MONEY PROCESS (IS FINISHED AFTER THEIR IDENTIFY IS VERIFIED)
app.post('/api/deposit', function(req, res) {
  // authenticate user
  if(_.indexOf(req.session.ledgers, req.body.objectId) < 0) {
    res.json({status: 'error', message: 'You don\'t have access to transfer money out of this listing'});
    return;
  }

  // continue if they have access
  stripe = require('stripe')(app.get('Stripe-Secret-Key'));

  // Create a Recipient
  stripe.recipients.create({
    name: req.body.legalName,
    type: req.body.depositorType,
    card: req.body.id,
    email: req.body.email,
    metadata: {
      ledgerId: req.body.objectId
    }
  }, function(err, recipient) {
    if(err) {
      logger.error(err);
      res.json({status: "error", message: err.message});
    }
    else {
      res.send(recipient);
    }
  });
});

// DEPOSIT MONEY TO CARD ONCE THEY'RE VERIFIED
app.post('/api/verify', function(req, res) {
  // authenticate user
  if(_.indexOf(req.session.ledgers, req.body.metadata.ledgerId) < 0) {
    res.json({status: 'error', message: 'You don\'t have access to transfer money out of this listing'});
    return;
  }

  // continue if they have access
  stripe = require('stripe')(app.get('Stripe-Secret-Key'));

  stripe.recipients.update(req.body.id, {
    tax_id: req.body.verifyNumber
  }, function(err, updatedUser) {
    if(err) {
      logger.error(err);
      res.json({status: "error", message: err.message});
    }
    else {
      if(!updatedUser.verified) {
        res.json({status: "error", message: "We couldn't verify your identity. Please send us an email."});
        updatedUser.error = "couldn't verify identity";
        logger.error(updatedUser);
      }
      else if(updatedUser.verified) {
        // send a success message 'prematurely' for a faster response
        res.json({status: "success", message: "Your money transfer is complete."});

        // get the remaining balance (we don't trust user input)
        getRemainingBalance(req.body.metadata.ledgerId, function(remainingBalance) {
          // finish the debit card transfer
          stripe.transfers.create({
            amount: remainingBalance,
            currency: "usd",
            recipient: req.body.id,
            metadata: {
              ledgerId: req.body.metadata.ledgerId
            }
          }, function(err, transfer) {
            if(err) {
              // save failed data to parse
              request.post({
                json: err,
                url: 'https://api.parse.com/1/classes/Transfers',
                headers: {
                  'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
                  'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
                },
                strictSSL: true,
                gzip: true
              },
              function(error, message, body) {
                if(error) console.log(error);
              });
            }
            else {
            // save transfer data to parse
              request.post({
                json: transfer,
                url: 'https://api.parse.com/1/classes/Transfers',
                headers: {
                  'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
                  'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
                },
                strictSSL: true,
                gzip: true
              },
              function(error, message, body) {
                if(error) console.log(error);
              });
            }
          });
        });
      }
    }
  });


});

// GET PAYMENTS FOR A PARTICULAR LEDGER
app.get('/api/ledger/:id/charges', function(req, res) {
  var query = encodeURI('where={"ledgerId": "' + req.params.id + '"}');
  request.get({
    url: 'https://api.parse.com/1/classes/Charges?' + query,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    // todo: log body.error
    // todo: log error
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

    // send off the payments
    res.json({results: filteredCharges});
  })
});

// GET TRANSFERS FOR A PARTICULAR LEDGER
app.get('/api/ledger/:id/payouts', function(req, res) {
  // authenticate user
  if(_.indexOf(req.session.ledgers, req.params.id) < 0) {
    res.json({status: 'error', message: 'You don\'t have access to view the payouts for this listing'});
    return;
  }

  var query = encodeURI('where={"metadata.ledgerId": "' + req.params.id + '"}');
  request.get({
    url: 'https://api.parse.com/1/classes/Transfers?' + query,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    // todo: log body.error
    // todo: log error
    var bodyObject = JSON.parse(body);

    // select only certain fields to make public
    var filteredPayouts = [];
    _.each(bodyObject.results, function(element, index, list) {
      element.cardBrand = element.card.type;
      element.cardTemp = {};
      element.cardTemp.last4 = element.card.last4;
      element.cardTemp.exp_month = element.card.exp_month;
      element.cardTemp.exp_year = element.card.exp_year;
      element.cardTemp.recipient = element.card.recipient;
      element = _.pick(element, [
        'cardBrand',
        'amount',
        'created',
        'status',
        'fee',
        'cardTemp'
      ]);
      element.card = element.cardTemp;
      element.cardTemp = undefined;
      filteredPayouts.push(element);
    });

    // send off the payments

    res.json({results: filteredPayouts});
    // res.json(bodyObject);
  })
});

// LOG OUT OF SESSION
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

// LOG IN TO SESSION USING SPECIAL LINK
app.get('/:id/authorize', function(req, res) {
  request.get({
    url: 'https://api.parse.com/1/classes/Ledgers/' + req.params.id,
    headers: {
      'X-Parse-Application-Id': app.get('X-Parse-Application-Id'),
      'X-Parse-REST-API-Key': app.get('X-Parse-REST-API-Key')
    },
    strictSSL: true,
    gzip: true
  }, function(error, message, body) {
    body = JSON.parse(body);

    if(body.secretKey === req.query.secret) {
      var hour = 3600000
      req.session.cookie.maxAge = hour * 24 * 30;

      // save ledger id to session
      req.session.ledgers = req.session.ledgers ? req.session.ledgers : [];
      req.session.ledgers.push(req.params.id);

      res.redirect(302, '/' + req.params.id);
    }
    else {
      res.redirect(302, '/' + req.params.id + '?error=badKey');
      // todo: create ui for badkey
    }
  })
});

app.get('*', function(req, res) {
  // send single page app
  res.sendFile('index.html', {'root': 'public'});
})

http.createServer(app).listen(8080, 'localhost', function() {
  console.log("server listening on http://localhost:8080");
});

// todo: setup parse.onbeforecloudsave to check for unique /custom-url