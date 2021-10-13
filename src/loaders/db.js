const sql = require("mysql");

module.exports = function () {
  var connection = sql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "door",
  });

  connection.query(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY NOT NULL, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`,
    function (err, result) {
      if (err) throw err;
    }
  );
  connection.query(
    `CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, token TEXT, FOREIGN KEY (userID) REFERENCES users (id))`,
    function (err, result) {
      if (err) throw err;
    }
  );
  connection.query(
    `CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER, card TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id))`,
    function (err, result) {
      if (err) throw err;
    }
  );
  connection.query(
    `CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, permission TEXT, FOREIGN KEY (userID) REFERENCES users (id))`,
    function (err, result) {
      if (err) throw err;
    }
  );
  connection.query(
    `CREATE TABLE IF NOT EXISTS logs (time TIME PRIMARY KEY NOT NULL, userID INTEGER, cardID INTEGER, action TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id), FOREIGN KEY (cardID) REFERENCES cards (id))`,
    function (err, result) {
      if (err) throw err;
    }
  );

  return connection;
};
