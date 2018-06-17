const Koa = require("koa");
var config = require("config");
const routes = require("./middleware/routes");
const Err = require("./middleware/error");
const app = new Koa();
function start() {
  app.use(routes());
  app.use(Err);

  app.listen(config.server.port, function() {
    console.log("%s listening at port %d", config.app.name, config.server.port);
  });
}
module.exports = start;
