import express from 'express'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'
import TokenGenerator from 'uuid-token-generator'
import bearerToken from 'express-bearer-token'


const tokgen = new TokenGenerator(256, TokenGenerator.BASE62);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// this is a top-level await 
var db;
(async () => {
    // open the database
    db = await open({
        filename: path.join(__dirname, '../api.db'),
        driver: sqlite3.Database,

    })
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS tokens (user TEXT, token TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS cards (user TEXT, card TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS permissions (user TEXT, permission TEXT)");
})()

const app = express()

app.use(express.json())

app.use(bearerToken());

const doorModes = {
    DEFAULT: "default",
    SCAN: "scan",
    OPEN: "open"
}

var doorMode = doorModes.DEFAULT

app.get("/door", async (req, res) => {
    //todo door authentication

    const cardData = req.query.card;

    const card = await db.get("SELECT *, rowid FROM cards WHERE card=?", [cardData]);

    console.log(card);

    if (!card) {
        res.send(JSON.stringify({
            open: false,
            reason: "card not found"
        }))
        return;
    }


    const permission = await db.get("SELECT *, rowid FROM permissions WHERE permission=\"door.open\" AND user=?", [card.user]);

    console.log(permission);

    if (!permission) {
        res.send(JSON.stringify({
            open: false,
            reason: "no permission"
        }))
        return;
    }
    else {
        res.send(JSON.stringify({
            open: true,
            reason: "allowed"
        }))
        return;
    }
})

app.get('/auth', async (req, res) => {
    if (req.body.username && req.body.password) {

        const { username, password } = req.body;

        const result = await db.get("SELECT * FROM users WHERE LOWER(username) LIKE LOWER(?) AND password=?", [username, password]);

        console.log(result);

        if (!result) {
            res.status(405).send("incorrect username or password");
            return;
        }

        const user = result.user;

        const token = tokgen.generate()

        db.run("INSERT INTO tokens VALUES (?, ?)", [user, token]);

        res.send(token);

    } else {
        res.status(400).send("no username and password")
    }
})


app.use(async (req, res, next) => {


    if (!req.token) {
        res.send("unauthorized");
        return;
    }

    const user = await db.get("SELECT *, rowid FROM tokens WHERE token=?", [req.token]);

    if (!user) {
        res.send("unauthorized")
        return;
    }

    const permissions = await db.all("SELECT *, rowid FROM permissions WHERE user=?", [user.user]) ?? [];
    req.permissions = permissions

    const userObject = await db.get("SELECT *, rowid FROM users WHERE rowid=?", [user.user]);
    req.user = userObject

    next()
});

app.get("/user/:user/cards", async (req, res) => {
    req.params.user

    const user = await db.get("SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?)", [req.params.user]);

    console.log(user);

    if (!user) {
        res.send("user not found")
        return;
    }

    const cards = await db.all("SELECT *, rowid FROM cards WHERE user=?", [user.rowid])

    console.log(user.rowid);

    res.send(cards);
})

app.get("/info", (req, res) => {
    res.send(JSON.stringify(
        {
            version: 1,
            api: "ft"
        }
    ))
})

app.put("/open", (req, res) => {

    if (req.permissions.includes("open_door")) {

        doorMode = doorModes.OPEN
        setTimeout(() => {
            doorMode = doorModes.DEFAULT
        },

            10000

        )

        res.send("ok")
    }

    else {
        res.send("insufficient permission")
    }


})

app.get("/cards", (req, res) => {
    
    res.redirect(`/user/${req.user.username}/cards`)

})


app.listen(80, function () {
    console.log('App listening')
})

