const express = require('express');
const loaders = require('./loaders');
const config = require('./config.json');

async function startServer() {

    const app = express();

    await loaders({ expressApp: app });

    app.listen(config.express.port, () => console.log(`API listening on port ${config.express.port}!`));
}

startServer();
