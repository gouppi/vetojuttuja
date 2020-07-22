const axios = require('axios');
/* @see .env file (not in github) */
const MONGO_USER = '';
const MONGO_PASS = '';
const MONGO_DB = '';
const MONGO_COLLECTION = '';

const MongoClient = require('mongodb').MongoClient;
const uri = `mongodb+srv://vetovahti2:${MONGO_PASS}@cluster0.zhemz.gcp.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`;
let client;

const colors = require('colors');
const information = require('./information.json');
const gameTypes = {
    "Counter Strike": ["COUNTER_STRIKE", "E-urheilu Counter-Strike"],
    "Dota 2": ["DOTA", "E-urheilu DOTA"],
    "League of Legends": ["LEAGUE_OF_LEGENDS", "E-urheilu League of Legends"],
    "Rainbow Six": ["RAINBOW_SIX", "E-urheilu Rainbow Six"],
    "StarCraft": ["STARCRAFT", "E-urheilu StarCraft"]
};

/**
 * Tries to find suitable team for given team names array
 * @param {Array<String>} names
 */
const findTeamFromInfo = (names) => {
    for (let i = 0; i < information.length; i++) {
        for (let j = 0; j < information[i].names.length; j++) {
            if (names.includes(information[i].names[j].name)) {
                return information[i];
            }
        }
    }
    return null;
}

/**
 * Tries to find suitable game for given game name
 * @param {String} game
 */
const findGame = (game) => {
    for (const [gameType, names] of Object.entries(gameTypes)) {
        if (names.includes(game)) {
            return gameType;
        }
    }
    return false;
}

/**
 * Tries to fetch game data from given endpoint.
 * Adds optional headers for request.
 * @param {String} endpoint
 * @param {JSON} headers
 */
const getDataFromEndpoint = async (endpoint, headers) => {
    try {
        return await axios.get(endpoint, { ...headers, method: 'get', });
    } catch (e) {
        console.log("Error status:", e)
        return false;
    }
}

const getClient = async () => {
    if (!client) {
        client = await MongoClient.connect(uri, { poolSize: 10, reconnectTries: 5000, useNewUrlParser: true })
            .catch(err => { console.log(err); });
    }
    return client;
}

const findGameFromDB = async (query) => {
    let result = null;
    const client = await getClient();
    if (client) {
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.findOne(query);
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const findGamesFromDB = async () => {
    console.log("FindGamesFromDB");
    let result = null;
    const client = await getClient();
    if (client) {
        console.log("Client on");
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.find().toArray();
            console.log("Data tuli");
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const insertGameToDB = async (data) => {
    let result = null;
    const client = await getClient();
    if (client) {
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.insertOne(data);
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const insertManyGamesToDB = async (data) => {
    let result = null;
    const client = await getClient();
    if (client) {
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.insertMany(data);
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const updateGame = async (query, newValues) => {
    let result = null;
    newValues = { $set: { ...newValues } };
    const client = await getClient();
    if (client) {
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.updateOne(query, newValues);
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const removeAllGamesFromDB = async () => {
    let result = null;
    const client = await getClient();
    if (client) {
        try {
            const collection = client.db(MONGO_DB).collection(MONGO_COLLECTION);
            result = await collection.deleteMany({});
        } catch (err) {
            console.log(err);
        }
    }
    return result;
}

const checkGameType = (type) => {
    type = type.toString();
    const types = {
        1: "HOME",
        2: "AWAY",
        3: "EVEN",
        X: "EVEN"
    };

    if (types.hasOwnProperty(type)) {
        return types[type];
    }
    return null;
}


module.exports = {
    findTeamFromInfo: findTeamFromInfo,
    findGame: findGame,
    getDataFromEndpoint: getDataFromEndpoint,
    findGameFromDB: findGameFromDB,
    findGamesFromDB: findGamesFromDB,
    insertGameToDB: insertGameToDB,
    insertManyGamesToDB: insertManyGamesToDB,
    updateGameToDB: updateGame,
    checkGameType: checkGameType,
    removeAllGamesFromDB: removeAllGamesFromDB
};