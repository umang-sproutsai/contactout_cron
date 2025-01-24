const CronLogs = require("../models/cronLogs"); // Adjust path as needed
const { syncCreateOrUpdateData } = require("./candidateController");

// Create a new Cron log
const createCronLog = async (data) => {
  const { skip, limit, status, message } = data;

  // Create a new cron log document
  const newCronLog = new CronLogs({
    skip,
    limit,
    status,
    message,
  });

  // Save the new cron log to the database
  await newCronLog.save();

  return newCronLog;
};

// Update an existing Cron log
const updateCronLog = async (data) => {
  const { id, skip, limit, status, message } = data;
  // Find the Cron log by ID and update it
  const updatedCronLog = await CronLogs.findByIdAndUpdate(id, {
    skip,
    limit,
    status,
    message,
  });
};

const getCronLogById = async (logId) => {
  try {
    console.log(`Fetching cron log with ID: ${logId}`);

    // Find the log by its ID
    const cronLog = await CronLogs.findById(logId);

    if (!cronLog) {
      console.log("No cron log found with the given ID.");
      return null;
    }

    console.log("Cron log found:", cronLog);
    return cronLog;
  } catch (error) {
    console.error("Error fetching the cron log by ID:", error);
    throw new Error("Error fetching the cron log by ID");
  }
};

const getLastCronLogSkip = async () => {
  try {
    console.log("Getting last cron log`");
    // Find the last cron log (most recent based on the createdAt field)
    const lastCronLog = await CronLogs.findOne().sort({ createdAt: -1 });

    if (!lastCronLog) {
      return null;
    }

    // Return the skip value of the last cron log
    console.log(`Last cron log ${lastCronLog}`);
    return parseInt(lastCronLog.skip);
  } catch (error) {
    console.error("Error fetching the last cron log:", error);
    throw new Error("Error fetching the last cron log");
  }
};

const syncData = async (req, res) => {
  try {
    await syncCron(req.body);
    return res.json({
      code: 200,
      message: "Data sync completed successfully",
    });
  } catch (error) {
    return res.json({
      code: 500,
      message: error.message,
      error: error.message,
    });
  }
};

const syncCron = async (data) => {
  let limit = data.limit;
  let skip = data.skip;
  //   let logData
  if (data.logId) {
    logData = await getCronLogById(data.logId);
    limit = logData.limit;
    skip = logData.skip;
  } else {
    logData = await createCronLog({
      skip,
      limit,
      message: "start",
      status: 888,
    });
  }
  try {
    // Call the syncCreateOrUpdateData function with skip and limit
    const data = await syncCreateOrUpdateData(limit, skip);
    updateCronLog({
      id: logData._id,
      status: 200,
      message: "Data sync completed successfully",
    });
  } catch (error) {
    console.error("Error syncing data:", error);
    updateCronLog({
      id: logData._id,
      status: 500,
      message: error.message,
    });
  }
};

module.exports = {
  createCronLog,
  updateCronLog,
  syncData,
  syncCron,
  getLastCronLogSkip,
};
