Parse.Cloud.beforeSave("Ledgers", function(req, res) {
  // limit name to 60 characters
  var name = req.object.get("name");
  if(name && name.length > 59) {
    req.object.set("name", name.substring(0, 59));
  }

  // limit description to 300 characters
  var description = req.object.get("description");
  if(description && description.length > 299) {
    req.object.set("description", description.substring(0, 299));
  }

  // limit items to 100
  var items = req.object.get("items");
  if(items && items.length > 99) {
    req.object.set("items", items.splice(0, 99));
  }

  // TODO: limit item name to 60 characters
  // TODO: parsefloat item.price and set max to 10,000.00

  // return success
  res.success();
});