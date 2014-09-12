var express = require('express'),
    bodyParser = require('body-parser');
var app = express();

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/api/cause', function(req, res) {
  setTimeout(function() {res.send(req.body);}, 1000);
  
});

app.listen(8080);