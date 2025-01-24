const mongoose = require('mongoose');

// Define a Mongoose schema for Task
const CronLogsSchema = new mongoose.Schema({
  skip: Number, //
  limit: Number, //
  status: Number, //
  message : String
},
{
    timestamps: true,
    collection: 'cron_log',
  }
);

module.exports = mongoose.model('Cronlogs', CronLogsSchema);
