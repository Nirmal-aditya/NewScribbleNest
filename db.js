const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://nirmaladitya0303:BhuI9hYEmVfxVsPo@scribblenest.o7yut.mongodb.net/ScribbleNest?retryWrites=true&w=majority';
let dbInstance;

const connectDB = async () => {
  if (dbInstance) {
    console.log('MongoDB is already connected');
    return dbInstance;
  }

  try {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    dbInstance = client.db('ScribbleNest'); // Set the database instance
    console.log('MongoDB connected');
    return dbInstance;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
