const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');

const saltRounds = 10; // for hashing passwords

module.exports = function (app, db) {
    const router = express.Router();

    router.get("/", (req, res) => res.status(200).sendFile(path.join(__dirname, '../../public/html', 'login.html')));
    
    router.get("/home", (req, res) => res.status(200).sendFile(path.join(__dirname, '../../public/html', 'main.html')));
    
    router.post('/auth', (req, res) => {
        let username, password;
        if(req.body.username && req.body.password) ({username, password} = req.body);
        else {
            res.status(400).send('Please enter username and password!');
            return;
        }
        const results = db.query(`SELECT * FROM users WHERE username = ?`, [username]);
        if (results.length > 0) {
                if(bcrypt.compareSync(password, results[0].password)) res.redirect('/home');
                else res.status(200).send('Incorrect username and/or password!');
        } else res.status(401).send('Incorrect username and/or password!');
    });

    router.route('/user')
    .get(function(req, res) {
        
    })
    .put(async (req, res) => {
        const username = req.query.username;
        let password = req.query.password;
        
        if (!username || !password) {
            res.status(400).send('Please enter username and password!');        
            return;
        }
        
        const existing = await db.query(`SELECT username FROM users WHERE LOWER(username)=LOWER(?)`, [username]);
        
        if (!existing) {
            password = bcrypt.hashSync(password, saltRounds);

            await db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [
            username,
            password,
            ]);
        
            res.status(200).send("ok");
        } else res.send("user already exists");
    });

    router.get("*", (req, res) => res.status(404).redirect('https://http.cat/404'));

    return router;
}   