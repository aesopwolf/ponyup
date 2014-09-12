var express = require('express');
var app = express();

app.get('/api/test', function(req, res) {
  res.send("test");
});

app.listen(8080);