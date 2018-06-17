var query = require("mysql-query-promise");
var config = require("config");

const crud = {
  getAllnow: async () => {
    return query(` SELECT data from rigsdata ORDER BY id DESC LIMIT 1`); //`;
  }
};
//export default crud;
module.exports = crud;
