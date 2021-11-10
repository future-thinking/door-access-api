const mqtt = require('mqtt');
const config = require('../config.json').mqtt;

const doorModes = {
    DEFAULT: "default",
    SCAN: "scan",
    OPEN: "open",
  };
  
  let doorMode = {
    mode: doorModes.DEFAULT,
  };

module.exports = function (connection){
    const client = mqtt.connect(config.host);

    client.on('connect', function () {
    client.subscribe(config.cards, function (err) {
        if (!err) console.error(err);
    });
    });

    client.on('message', async function (topic, message) {
        const cardData = message.toString();
        console.log("Scanned card: " + cardData);

        const card = connection.query(`SELECT * FROM cards WHERE card=?`, [cardData]);

        if (doorMode.mode === doorModes.SCAN) {
            doorMode.mode = doorModes.DEFAULT;

            if (card.length <= 0) {
                connection.query(`INSERT INTO cards (userID, card) VALUES (?, ?)`, [doorMode.userID, cardData]);
                const newCard = await connection.query(`SELECT * FROM cards WHERE card = ?`, [cardData]);
                connection.query(
                    `INSERT INTO logs (time, userID, cardID, action) VALUES (now(), ?, ?, ?)`,
                    [
                    doorMode.userID,
                    newCard.id,
                    `add card ${cardData}`,
                    ]
                );
            } else {
                connection.query(
                    `INSERT INTO logs (time, userID, cardID, action) VALUES (now(), ?, ?, ?)`,
                    [
                    doorMode.userID,
                    card.id,
                    `card to be added already exists`,
                    ]
                );
            }
            client.publish(config.state, 'false');
            return;
        }

        if (card.length <= 0) {
            client.publish(config.state, 'false');
            connection.query(
                `INSERT INTO logs (time, userID, cardID, action) VALUES (now(), NULL, NULL, ?)`,
                [`scanned card doesn't exist`]);
            return;
        }

        const permission = await connection.query(`SELECT * FROM permissions WHERE permission='open.door' AND userID=?`, [card.userID]);

        if (!permission) {
            connection.query(
            `INSERT INTO logs (time, userID, cardID, action) VALUES (now(), ?, ?, ?)`,
            [card.userID, card.id, `user does not have permission to open door`]);
            client.publish(config.state, 'false');
            return;
        } else {
            connection.query(
            `INSERT INTO logs (time, userID, cardID, action) VALUES (now(), ?, ?, ?)`,
            [card.userID, card.id, `door opened by user`]
            );
            client.publish(config.state, 'true');
            return;
        }
    });
}