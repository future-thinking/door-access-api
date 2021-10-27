const sql = require('sync-mysql');

module.exports = function () {
  var connection = new sql(require('../config.json').sql);

  connection.query(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY NOT NULL, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`);
  connection.query(`CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, token TEXT, FOREIGN KEY (userID) REFERENCES users (id))`);
  connection.query(`CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, card TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id))`);
  connection.query(`CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, permission TEXT, FOREIGN KEY (userID) REFERENCES users (id))`);
  connection.query(`CREATE TABLE IF NOT EXISTS logs (time TIMESTAMP PRIMARY KEY NOT NULL, userID INTEGER, cardID INTEGER, action TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id), FOREIGN KEY (cardID) REFERENCES cards (id))`);

  setInterval(function () {
    connection.query('SELECT 1');
  }, 5000);

  return connection;
};
