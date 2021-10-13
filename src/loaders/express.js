const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('../config.json');

const routes = require('../routes');

module.exports = function ({ app }, connection){

    app.get('/status', (req, res) => { res.status(200).end(); });
    app.head('/status', (req, res) => { res.status(200).end(); });

    app.use(express.static(path.join(__dirname, "../../public")));
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use(session({
        secret: config.express.session_secret,
        resave: true,
        saveUninitialized: true
    }));
    app.use(routes(app, connection));
    
    return app;
}