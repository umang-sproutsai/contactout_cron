// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');

const { getCandidates ,findElasticCandidate } = require('./controllers/candidateController');
const {createCronLog , syncData, syncCron , getLastCronLogSkip} = require('./controllers/cronLogsController');

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());

// MongoDB Connection

const mongoURI = 'mongodb://SpourtsAI:fwcrwDuj9ClhgVW@35.223.236.73:27017/?directConnection=true';

// Connect to MongoDB
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'candidate', // Specify the database name to use
});

const db = mongoose.connection;
db.on('connected', () => console.log('Connected to MongoDB.'));
db.on('error', (err) => console.error('MongoDB connection error:', err));

// Routes
app.get('/candidate-details', getCandidates)
app.post('/elsetic-candidate', findElasticCandidate)

//cron
app.post('/sync-data', syncData)

// Set up a cron job to run every minute
let limit = 200
let skip = 0
cron.schedule('* * * * *', async () => {
  try {
    console.log('Running cron job: Checking incomplete tasks.');
    if(skip <1){
        skip = await getLastCronLogSkip() || 0
    }
    skip  = skip + limit
    await syncCron({limit, skip})
    console.log('Incomplete tasks:');
  } catch (err) {
    console.error('Error during cron job:', err);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
