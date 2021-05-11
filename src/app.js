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

var doorMode = {
    mode: doorModes.DEFAULT
}

console.log(doorMode)

app.post("/add/user", async (req, res) => {
    
    const username = req.query.username
    const password = req.query.password

    if (!username || !password) {
        res.status(400).send("both password and username are required!");

        return;
    }

    const existing = await db.get("SELECT username FROM users WHERE LOWER(username)=LOWER(?)", [username]);
    
    if (!existing) {
        const user = await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]);
    
        res.status(200).send("ok");

        return;
    }

    else {
        res.send("user already exists")

        return;
    }
});

app.get("/door", async (req, res) => {
    //todo door authentication

    const cardData = req.query.card;

    const card = await db.get("SELECT *, rowid FROM cards WHERE card=?", [cardData]);

    console.log(card);

    if (doorMode.mode == doorModes.SCAN) {
        doorMode.mode = doorModes.DEFAULT

        res.send(JSON.stringify({
            open: false,
            reason: "scanning"
        }))

        db.run("INSERT INTO cards (user, card) VALUES (?, ?)", [doorMode.user.rowid, cardData])

        console.log(doorMode.user);

        return;
    }

    if (!card) {
        res.send(JSON.stringify({
            open: false,
            reason: "card not found"
        }))
        return;
    }

    const permission = await db.get("SELECT *, rowid FROM permissions WHERE permission=\"door.open\" AND user=?", [card.user]);

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

    console.log(user.user);

    const permissions = (await db.all("SELECT *, rowid FROM permissions WHERE user=?", [user.user])) .map(el => el.permission);
    req.permissions = permissions

    console.log(req.permissions);

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

app.post("/add/:user/card", async (req, res) => {

    const userID = await db.get("SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?)", [req.params.user]);

    if (req.permissions.includes("add_card")) {

        doorMode = { 
            mode: doorModes.SCAN,
            user: userID
        }
        
        setTimeout(() => {
            
            doorMode = { 
                mode: doorModes.DEFAULT
            }
        },

            10000

        )

        res.status(200).send("ok");
    }

    else {
        res.send("insufficient permission");
    }
})

app.get("/info", (req, res) => {
    res.send(JSON.stringify(
        {
            version: 1,
            api: "ft"
        }
    ))
})

app.put("/open", async (req, res) => {

    if (req.permissions.includes("open_door")) {

        doorMode = doorModes.OPEN
        setTimeout(() => {
            doorMode = doorModes.DEFAULT
        },

            10000

        )

        res.send("ok");
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


