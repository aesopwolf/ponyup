var express = require('express'),
    bodyParser = require('body-parser');
var app = express();

app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/api/cause', function(req, res) {
  res.send(req.body);
});

app.listen(8080);