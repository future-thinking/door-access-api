const expressLoader = require('./express');
const dbLoader = require('./db');
const mqttLoader = require('./mqtt');

module.exports = async function ({expressApp}) {
    const db = await dbLoader();
    console.log('DB Initialized');
    await mqttLoader(db);
    await expressLoader({app: expressApp}, db);
    console.log('Express Initialized');
}