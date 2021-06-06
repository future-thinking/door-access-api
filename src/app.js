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

let db;

(async () => {
    // open the database
    db = await open({
        filename: path.join(__dirname, '../api.db'),
        driver: sqlite3.Database,

    })
    await db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)`);
    await db.run(`CREATE TABLE IF NOT EXISTS tokens (user TEXT, token TEXT)`);
    await db.run(`CREATE TABLE IF NOT EXISTS cards (user TEXT, card TEXT)`);
    await db.run(`CREATE TABLE IF NOT EXISTS permissions (user TEXT, permission TEXT)`);
    console.log("Initialized Database");
})()

const app = express()

app.use(express.json())

app.use(bearerToken());

const doorModes = {
    DEFAULT: "default",
    SCAN: "scan",
    OPEN: "open"
}

let doorMode = {
    mode: doorModes.DEFAULT
}

app.post("/add/user", async (req, res) => {
    
    const username = req.query.username
    const password = req.query.password

    if (!username || !password) {
        res.status(400).send("both password and username are required!");

        return;
    }

    const existing = await db.get(`SELECT username FROM users WHERE LOWER(username)=LOWER(?)`, [username]);
    
    if (!existing) {
        await db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password]);
    
        res.status(200).send("ok");
    }

    else res.send("user already exists");
});

app.get("/door", async (req, res) => {
    //todo door authentication

    const cardData = req.query.card;

    const card = await db.get(`SELECT *, rowid FROM cards WHERE card=?`, [cardData]);

    console.log(card);

    if (doorMode.mode === doorModes.SCAN) {
        doorMode.mode = doorModes.DEFAULT

        const existing = await db.get(`SELECT card FROM cards WHERE card=?`, [cardData]);

        if (!existing) {        
            db.run(`INSERT INTO cards (user, card) VALUES (?, ?)`, [doorMode.user.rowid, cardData])
    
            res.send(JSON.stringify({
                open: false,
                reason: "scanning"
            }))
    
            return;
        }

        else {
            res.send(JSON.stringify({
                open: false,
                reason: "scanning",
                card: "card already exists"
            }))
            return;
        }
    }

    if (!card) {
        res.send(JSON.stringify({
            open: false,
            reason: "card not found"
        }))
        return;
    }

    const permission = await db.get(`SELECT *, rowid FROM permissions WHERE permission='open.door' AND user=?`, [card.user]);

    if (!permission) {
        res.send(JSON.stringify({
            open: false,
            reason: "no permission"
        }))
    }
    else {
        res.send(JSON.stringify({
            open: true,
            reason: "allowed"
        }))
    }
})

app.get('/auth', async (req, res) => {
    if (req.body.username && req.body.password) {

        const { username, password } = req.body;

        const result = await db.get(`SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?) AND password=?`, [username, password]);

        if (!result) {
            res.status(405).send("incorrect username or password");
            return;
        }

        const user = result.rowid;

        const token = tokgen.generate()

        db.run(`INSERT INTO tokens VALUES (?, ?)`, [user, token]);

        res.send(token);

    } else res.status(400).send("no username and password");
});


app.use(async (req, res, next) => {


    if (!req.token) {
        res.send("unauthorized");
        return;
    }

    const user = await db.get(`SELECT *, rowid FROM tokens WHERE token=?`, [req.token]);

    if (!user) {
        res.send("unauthorized");
        return;
    }

    req.permissions = (await db.all(`SELECT *, rowid FROM permissions WHERE user=?`, [user.user])) .map(el => el.permission);

    req.user = await db.get(`SELECT *, rowid FROM users WHERE rowid=?`, [user.user]);

    next()
});

app.get("/user/:user/cards", async (req, res) => {

    const user = await db.get(`SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?)`, [req.params.user]);

    if (!user) {
        res.send("user not found");
        return;
    }

    const cards = await db.all(`SELECT *, rowid FROM cards WHERE user=?`, [user.rowid]);

    res.send(cards);
})

app.post("/add/:user/card", async (req, res) => {

    const userID = await db.get(`SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?)`, [req.params.user]);

    if (req.permissions.includes("add.card")) {

        doorMode = { 
            mode: doorModes.SCAN,
            user: userID
        }
        
        setTimeout(() => {
            doorMode = { 
                mode: doorModes.DEFAULT
            }
        },10000)

        res.status(200).send("ok");
    }

    else res.send("insufficient permission");
})

app.patch("/user/:user/permissions/:permission", async (req, res) => {
    
    const permission = req.params.permission;
    const username = await db.get(`SELECT *, rowId FROM users WHERE LOWER(username)=LOWER(?)`, [req.params.user]);
    const existing = await db.get(`SELECT permission FROM permissions WHERE permission=? AND user=?`, [permission, username.rowid]);

    if (req.permissions.includes("add.permission") && req.query.changePermission === "add" && !existing){
        await db.all("INSERT INTO permissions (user, permission) VALUES (?, ?)", [username.rowid, permission]);

        res.status(200).send("ok");
    }

    else if (req.permissions.includes("remove.permission") && req.query.changePermission === "remove"){
        await db.all("DELETE FROM permissions WHERE user=? AND permission=?", [username.rowid, permission]);

        res.status(200).send("ok");
    }

    else if (existing)res.send("permission already exists");

    else res.send("insufficient permission");
}); 

app.get("/info", (req, res) => {
    res.send(JSON.stringify(
        {
            version: 1,
            api: "ft"
        }
    ));
});

app.put("/open", async (req, res) => {

    if (req.permissions.includes("open.remote")) {

        doorMode = doorModes.OPEN
        setTimeout(() => {
            doorMode = doorModes.DEFAULT
        },10000);

        res.send("ok");
    }

    else res.send("insufficient permission");
});

app.get("/cards", (req, res) => {
    
    res.redirect(`/user/${req.user.username}/cards`);

});


app.listen(80, function () {
    console.log('App listening');
});


