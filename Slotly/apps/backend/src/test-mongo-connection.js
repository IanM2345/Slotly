const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://keslotly:FHVvqRNjjSGjmY8N@cluster0.gdwh7xk.mongodb.net/slotly?retryWrites=true&w=majority&appName=Cluster0";

async function testConnection() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB!");
    
    const databases = await client.db().admin().listDatabases();
    console.log("Databases:");
    databases.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    await client.close();
  }
}

testConnection();
