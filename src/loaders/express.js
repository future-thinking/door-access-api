const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config.json');

const routes = require('../routes');

module.exports = function ({ app }, connection){

    app.use(express.static(path.join(__dirname, "../../public")));
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use(session({
        secret: config.express.session_secret,
        resave: true,
        saveUninitialized: true
    }));
    app.use((req, res, next) => {
        if (!req.session.token) {
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
    app.use(routes(app, connection));
    
    return app;
}