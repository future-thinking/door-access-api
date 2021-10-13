const expressLoader = require('./express');
const dbLoader = require('./db');

module.exports = async function ({expressApp}) {
    const db = await dbLoader();
    console.log('DB Initialized');
    await expressLoader({app: expressApp}, db);
    console.log('Express Initialized');
}