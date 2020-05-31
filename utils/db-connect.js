const {MongoClient} = require("mongodb");
require("dotenv").config();

async function dbConnect() {
    const uri = process.env.DB_URI;

    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        await listDatabases(client);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}