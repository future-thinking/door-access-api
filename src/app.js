import express from 'express'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url';
import TokenGenerator from 'uuid-token-generator'

const tokgen = new TokenGenerator(256, TokenGenerator.BASE62);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// this is a top-level await 
var db;
(async () => {
    // open the database
    db = await open({
      filename: path.join(__dirname, 'api.db') ,
      driver: sqlite3.Database,
      
    })
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS tokens (user TEXT, token TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS cards (user TEXT, card TEXT)");
})()

const app = express()

app.use(express.json())



app.get("/user/:user/cards", async (req, res)=> {
    req.params.user

    const user = await db.get("SELECT *, rowid FROM users WHERE LOWER(username) LIKE LOWER(?)", [req.params.user]);

    console.log(user);

    if (!user){
        res.send("user not found")
        return;
    }

    const cards = await db.all("SELECT * FROM cards WHERE user=?", [user.rowid])

    console.log(user.rowid);

    res.send(cards);
})

app.get('/auth', async (req, res) => {
    if (req.body.username && req.body.password) {

//TODO LOGIN
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



app.listen(80, function (){
    console.log('App listening')
} )

