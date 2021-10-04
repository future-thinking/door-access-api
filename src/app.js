import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import TokenGenerator from "uuid-token-generator";
import bearerToken from "express-bearer-token";

const tokgen = new TokenGenerator(256, TokenGenerator.BASE62);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

(async () => {
  // open the database
  db = await open({
    filename: path.join(__dirname, "../db/api.db"),
    driver: sqlite3.Database,
  });
  await db.run(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY NOT NULL, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, token TEXT, FOREIGN KEY (userID) REFERENCES users (id))`
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER, card TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id))`
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY NOT NULL, userID INTEGER NOT NULL, permission TEXT, FOREIGN KEY (userID) REFERENCES users (id))`
  );
  await db.run(
    `CREATE TABLE IF NOT EXISTS logs (time TIME PRIMARY KEY NOT NULL, userID INTEGER, cardID INTEGER, action TEXT NOT NULL, FOREIGN KEY (userID) REFERENCES users (id), FOREIGN KEY (cardID) REFERENCES cards (id))`
  );
  console.log("Initialized Database");
})();

const app = express();

app.use(express.json());

app.use(bearerToken());

const doorModes = {
  DEFAULT: "default",
  SCAN: "scan",
  OPEN: "open",
};

let doorMode = {
  mode: doorModes.DEFAULT,
};

app.use(express.static(path.join(__dirname, "../public")));

app.get("/add/user", async (req, res) => {
  const username = req.query.username;
  const password = req.query.password;

  if (!username || !password) {
    res.status(400).send("both password and username are required!");

    return;
  }

  const existing = await db.get(
    `SELECT username FROM users WHERE LOWER(username)=LOWER(?)`,
    [username]
  );

  if (!existing) {
    await db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [
      username,
      password,
    ]);

    res.status(200).send("ok");
  } else res.send("user already exists");
});

app.get("/door", async (req, res) => {
  //TODO door authentication
  console.log("door request");

  const cardData = req.query.card;
  console.log(cardData);

  const card = await db.get(`SELECT * FROM cards WHERE card=?`, [cardData]);

  console.log(card);

  if (doorMode.mode === doorModes.SCAN) {
    doorMode.mode = doorModes.DEFAULT;

    const existing = await db.get(`SELECT card FROM cards WHERE card=?`, [
      cardData,
    ]);

    if (!existing) {
      db.run(`INSERT INTO cards (userID, card) VALUES (?, ?)`, [
        doorMode.userID,
        cardData,
      ]);
      const newCard = await db.run(`SELECT * FROM cards WHERE card = ?`, [
        cardData,
      ]);
      db.run(
        `INSERT INTO logs (time, userID, cardID, action) VALUES (datetime(?), ?, ?, ?)`,
        [
          toIsoString(new Date()),
          doorMode.userID,
          newCard.id,
          `add card ${cardData}`,
        ]
      );
      res.send(
        JSON.stringify({
          open: false,
          reason: "scanning",
        })
      );

      return;
    } else {
      db.run(
        `INSERT INTO logs (time, userID, cardID, action) VALUES (datetime(?), ?, ?, ?)`,
        [
          toIsoString(new Date()),
          doorMode.userID,
          card.id,
          `card to be added already exists`,
        ]
      );
      res.send(
        JSON.stringify({
          open: false,
          reason: "scanning",
          card: "card already exists",
        })
      );
      console.log("allowing");
      return;
    }
  }

  if (!card) {
    db.run(`INSERT INTO cards (userID, card) VALUES (?, ?)`, [
      doorMode.userID,
      cardData,
    ]);
    const newCard = await db.run(`SELECT * FROM cards WHERE card = ?`, [
      cardData,
    ]);
    db.run(
      `INSERT INTO logs (time, userID, cardID, action) VALUES (datetime(?), ?, ?, ?s)`,
      [toIsoString(new Date()), null, newCard.id, `scanned card not found`]
    );
    res.send(
      JSON.stringify({
        open: false,
        reason: "card not found",
      })
    );
    return;
  }

  const permission = true; //await db.get(
  //   `SELECT * FROM permissions WHERE permission='open.door' AND userID=?`,
  //   [card.userID]
  // );

  if (!permission) {
    db.run(
      `INSERT INTO logs (time, userID, cardID, action) VALUES (datetime(?), ?, ?, ?)`,
      [
        toIsoString(new Date()),
        card.userID,
        card.id,
        `user does not have permission to open door`,
      ]
    );
    res.send(
      JSON.stringify({
        open: false,
        reason: "no permission",
      })
    );
  } else {
    db.run(
      `INSERT INTO logs (time, userID, cardID, action) VALUES (datetime(?), ?, ?, ?)`,
      [toIsoString(new Date()), card.userID, card.id, `door opened by user`]
    );
    res.send(
      JSON.stringify({
        open: true,
        reason: "allowed",
      })
    );
  }
});

app.get("/auth", async (req, res) => {
  if (req.query.username && req.query.password) {
    const { username, password } = req.query;

    const result = await db.get(
      `SELECT * FROM users WHERE LOWER(username) LIKE LOWER(?) AND password=?`,
      [username, password]
    );

    if (!result) {
      res.status(405).send("incorrect username or password");
      return;
    }

    const user = result.id;

    const token = tokgen.generate();

    db.run(`INSERT INTO tokens (userID, token) VALUES (?, ?)`, [user, token]);

    res.send(token);
  } else res.status(400).send("no username and password");
});

app.use(async (req, res, next) => {
  if (!req.token) {
    res.send("unauthorized");
    return;
  }

  const user = await db.get(`SELECT * FROM tokens WHERE token=?`, [req.token]);

  if (!user) {
    res.send("unauthorized");
    return;
  }

  req.permissions = (
    await db.all(`SELECT * FROM permissions WHERE userID=?`, [user.userID])
  ).map((el) => el.permission);

  req.user = await db.get(`SELECT * FROM users WHERE id=?`, [user.userID]);

  next();
});

app.get("/user/:user/cards", async (req, res) => {
  const user = await db.get(
    `SELECT * FROM users WHERE LOWER(username) LIKE LOWER(?)`,
    [req.params.user]
  );

  if (!user) {
    res.send("user not found");
    return;
  }

  const cards = await db.all(`SELECT * FROM cards WHERE userID=?`, [user.id]);

  res.send(cards);
});

app.post("/add/:user/card", async (req, res) => {
  const user = await db.get(
    `SELECT * FROM users WHERE LOWER(username) LIKE LOWER(?)`,
    [req.params.user]
  );

  doorMode = {
    mode: doorModes.SCAN,
    userID: user.id,
  };

  setTimeout(() => {
    doorMode = {
      mode: doorModes.DEFAULT,
    };
  }, 10000);

  res.status(200).send("ok");
});

app.patch("/user/:user/permissions/:permission", async (req, res) => {
  const permission = req.params.permission;
  const user = await db.get(
    `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`,
    [req.params.user]
  );
  const existing = await db.get(
    `SELECT permission FROM permissions WHERE permission = ? AND userID = ?`,
    [permission, user.id]
  );

  if (
    req.permissions.includes("add.permission") &&
    req.query.changePermission === "add" &&
    !existing
  ) {
    await db.all("INSERT INTO permissions (userID, permission) VALUES (?, ?)", [
      user.id,
      permission,
    ]);

    res.status(200).send("ok");
  } else if (
    req.permissions.includes("remove.permission") &&
    req.query.changePermission === "remove"
  ) {
    await db.all("DELETE FROM permissions WHERE userID=? AND permission=?", [
      user.id,
      permission,
    ]);

    res.status(200).send("ok");
  } else if (existing) res.send("permission already exists");
  else res.send("insufficient permission");
});

app.get("/info", (req, res) => {
  res.send(
    JSON.stringify({
      version: 1,
      api: "ft",
    })
  );
});

app.put("/open", async (req, res) => {
  if (req.permissions.includes("open.remote")) {
    doorMode = doorModes.OPEN;
    setTimeout(() => {
      doorMode = doorModes.DEFAULT;
    }, 10000);

    res.send("ok");
  } else res.send("insufficient permission");
});

app.get("/cards", (req, res) => {
  res.redirect(`/user/${req.user.username}/cards`);
});

app.listen(80, function () {
  console.log(`listening on *:${80}`);
});

function toIsoString(date) {
  let tzo = -date.getTimezoneOffset(),
    dif = tzo >= 0 ? "+" : "-",
    pad = function (num) {
      let norm = Math.floor(Math.abs(num));
      return (norm < 10 ? "0" : "") + norm;
    };

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    dif +
    pad(tzo / 60) +
    ":" +
    pad(tzo % 60)
  );
}
