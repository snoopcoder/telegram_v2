const router = require("koa-router")();
const koaBody = require("koa-body");
const rigs = require("../models/rigs");

router.get("/rigsnow", async (ctx, next) => {
  let res = await rigs.getAllnow();
  ctx.body = JSON.parse(res[0].data);
  console.log("dfdfdf");
});

module.exports = router.routes.bind(router);
