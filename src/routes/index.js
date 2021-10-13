const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');

const saltRounds = 10; // for hashing passwords

module.exports = function (app, db) {
    const router = express.Router();

    router.get("/", (req, res) => res.status(200).sendFile(path.join(__dirname, '../../public/html', 'login.html')));
    
    router.get("/home", (req, res) => res.status(200).sendFile(path.join(__dirname, '../../public/html', 'main.html')));
    
    router.post('/auth', function(req, res) {
        var username = req.body.username;
        var password = req.body.password;
        if (username && password) {
            db.query('SELECT * FROM users WHERE username = ?', [username], function(error, results, fields) {
                if (results.length > 0) {
                        if(bcrypt.compareSync(password, results[0].password)) res.redirect('/home');
                        else res.status(200).send('Incorrect Username and/or Password!');
                } else res.status(401).send('Incorrect Username and/or Password!');
            });
        } else res.status(400).send('Please enter Username and Password!');
    });

    router.get("*", (req, res) => res.status(404).redirect('https://http.cat/404'));

    return router;
}   