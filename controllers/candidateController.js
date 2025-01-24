const CandidateDetails = require("../models/candidateDetails");
const axios = require("axios");
const client = require("../elasticConfig");
const region = require("../region_map.json");

// Get all candidate details
const getCandidates = async (req, res) => {
  try {
    const candidates = await CandidateDetails.find().limit(10);
    res.status(200).json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Find data by LinkedIn ID in Elasticsearch
const findElasticCandidate = async (req, res) => {
  console.log("Request body:", req.body); // Log the full body
  const linkedin = req.body.linkedin;
  const index = req.body.index;

  try {
    console.log("Searching for LinkedIn ID:", linkedin);
    console.log("Searching for index:", index);
    const response = await client.search({
      index: index,
      body: {
        query: {
          term: {
            "linkedin.keyword": linkedin,
          },
        },
      },
    });
    console.log("Search results:", response.hits.hits); // Log the search results
    return res.status(200).json(response.hits.hits); // Respond with the hits
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create or update candidate data in Elasticsearch
const syncCreateOrUpdateData = async (limit, skip) => {
  try {
    // Fetch candidate details from the database

    const candidateDetails = await CandidateDetails.find({
      // linkedin: "https://www.linkedin.com/in/bharathgr2203",
      linkedin: { $ne: null, $exists: true },
    })
      .skip(skip)
      .limit(limit)
      .lean();
    // console.log("candiant details", candidateDetails);
    if (candidateDetails.length === 0) {
      return { success: true, message: "No candidate details found to index." };
    }

    for (const candidate of candidateDetails) {
      const id = candidate._id.toString();
      const linkedin = candidate.linkedin;

      if (!linkedin) {
        console.log(`No LinkedIn key found for candidate: ${id}`);
        continue;
      }
      console.log(`Processing LinkedIn ID: ${linkedin}`);

      // find location wise partition index
      let { location, partition } = await findPartitionsAndLocation(
        candidate.location
      );
      candidate.coordinates = getCoordinates(candidate.location);
      candidate.location = location;

      // Search for existing documents in Elasticsearch
      const searchResult = await client.search({
        index: partition,
        body: {
          query: {
            term: { "linkedin.keyword": linkedin },
          },
        },
      });

      const hits = searchResult.hits.hits;
      if (hits.length > 0) {
        const existingId = hits[0]._id;
        // console.log(`Found existing`,hits)
        await client.update({
          index: partition,
          id: existingId,
          body: mapToElasticsearchUpdate(candidate, hits[0]._source),
        });
        console.log(`Successfully updated candidate: ${linkedin}`);
      } else {
        await client.index({
          index: partition,
          id,
          body: mapToElasticsearchCreate(candidate),
        });
        console.log(`Successfully indexed candidate: ${linkedin}`);
      }
    }

    return {
      success: true,
      message: "Candidate details indexed successfully.",
    };
  } catch (error) {
    console.error(`Error creating or updating data: ${error.message}`);
    throw new Error(`Error creating or updating data: ${error.message}`);
  }
};

// Map candidate details to Elasticsearch format for create
function mapToElasticsearchCreate(candidate) {
  return {
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    linkedin: candidate.linkedin,
    title: candidate.title,
    email: candidate.email,
    phone: candidate.phone,
    skills: getSkills(candidate.skills),
    summary: candidate.summary,
    current_title: candidate.title,
    total_exp_years: getTotalExperience(
      candidate.years_experience,
      candidate.months_experience
    ),
    location: candidate.location,
    coordinates: candidate.coordinates,
    experience: candidate.experience ? getExperience(candidate.experience) : [],
    education: candidate.education ? getEducation(candidate.education) : [],
    current_company: candidate.current_company
      ? getCurrentCompany(candidate.current_company)
      : {},
  };
}

// Map candidate details to Elasticsearch format for updating
function mapToElasticsearchUpdate(candidate, oldData) {
  return {
    doc: {
      first_name: oldData.first_name || candidate.first_name,
      last_name: oldData.last_name || candidate.last_name,
      linkedin: oldData.linkedin || candidate.linkedin,
      current_title: oldData.current_title || candidate.title,
      title: oldData.title || candidate.title,
      current_company:
        oldData.current_company || getCurrentCompany(candidate.current_company),
      location: oldData.location || candidate.location,
      coordinates: oldData.coordinates || candidate.coordinates,
      total_exp_years: getLargerNumber(
        oldData.total_exp_years,
        getTotalExperience(
          candidate.years_experience,
          candidate.months_experience
        )
      ),
      email: getLargerArray(oldData.email, candidate.email),
      phone: getLargerArray(oldData.phone, candidate.phone),
      skills: getLargerArray(oldData.skills, getSkills(candidate.skills)),
      summary: getLargerString(oldData.summary, candidate.summary),
      experience: getLargerArray(
        oldData.experience,
        getExperience(candidate.experience)
      ),
      education: getLargerArray(
        oldData.experience,
        getEducation(candidate.education)
      ),
    },
  };
}

// Get coordinates from location
function getCoordinates(data) {
  if (!data || data.length === 0 || !data[0]?.lat || !data[0]?.lon ) return null;
  return {
    lat: data[0]?.lat,
    lon: data[0]?.lon,
  };
}
// Format date to "Month Year"
function getFormattedMonthAndYear(dateString) {
  if (!dateString || dateString == null) return;
  const date = new Date(dateString);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (monthNames[date.getMonth()] == NaN || date.getFullYear() == NaN)
    return null;
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

//get skills
function getSkills(data) {
  if(!data || data == null) return []
  if (Array.isArray(data) && data.every((item) => typeof item !== "object")) {
    return data;
  }
  const skillArray = data.flatMap((item) =>
    item.skills.map((subItem) => subItem.skills)
  );
  return skillArray;
}
//get total experience
function getTotalExperience(year, moment) {
  const totalExp = (year || 0) + (moment || 0) / 12;
  return parseFloat(totalExp).toFixed(1);
}

// Calculate duration in "years months"
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years == NaN || months == NaN) return null;

  return `${years} years ${months} months`;
}

// Map experience details
function getExperience(data) {
  return data.map((experience) => ({
    end_date: getFormattedMonthAndYear(experience.end),
    description_html: experience.description,
    url: experience.url,
    company_id: experience.company_id,
    start_date: getFormattedMonthAndYear(experience.start),
    title: experience.position,
    duration_short: calculateDuration(experience.start, experience.end),
    company: experience.company,
  }));
}

// Map education details
function getEducation(data) {
  return data.map((education) => ({
    end_year: getFormattedMonthAndYear(education.end),
    start_year: getFormattedMonthAndYear(education.start),
    degree: education.degree,
    description: education.description,
    url: education.url,
    title: education.school,
    field: education.field,
  }));
}

//get current company
function getCurrentCompany(data) {
  if (data) {
    return {
      name: data,
    };
  } else {
    return {};
  }
}

async function findPartitionsAndLocation(location) {
  let locationInfo = {
    location: "",
    partition: "reject_candidate", // Default partition
  };
  
  if (location && location.length > 0) {
    if (Array.isArray(location[0])) {
      location[0] = location[0][0]
    }
    // Build a readable location string
    const locationParts = [];
    if (location[0].city) locationParts.push(location[0].city);
    if (location[0].state) locationParts.push(location[0].state);
    if (location[0].country) locationParts.push(location[0].country);
    locationInfo.location = locationParts.join(", ");

    if (!location[0].country) {
      const data = await getLocationGoogleApi(locationInfo.location);
      if (data && typeof data == "string") {
        locationParts.push(data); // Add the country name from the API
      } else {
        console.error(
          "Failed to fetch country from Google API. Using default partition."
        );
      }
    }

    // Normalize location parts for matching
    const normalizedParts = locationParts.map((part) => part.toLowerCase());

    // Find partition by matching locationParts with the region map
    for (const [key, regions] of Object.entries(region)) {
      if (
        regions.some((regionName) => {
          const normalizedRegion = regionName.toLowerCase();
          return normalizedParts.includes(normalizedRegion);
        })
      ) {
        locationInfo.partition = `people_${key}`;
        break; // Stop searching once a match is found
      }
    }
  }
  console.log(locationInfo);
  return locationInfo;
}

async function getLocationGoogleApi(address) {
  const url = "https://maps.googleapis.com/maps/api/geocode/json";

  try {
    // Make an API request to Google Geocoding
    const response = await axios.get(url, {
      params: {
        address, // The address to geocode
        key: "AIzaSyDMHOsdJGrAktcAJaS38U-maHAMITTCsEU", // Your API key
      },
      timeout: 10000, // Set a timeout of 10 seconds
    });
    const results = response?.data?.results;
    if (!results || results.length === 0) {
      return null; // No results found
    }

    const addressComponents = results[0].address_components;
    for (const component of addressComponents) {
      if (component.types.includes("country")) {
        return component.long_name; // Return the country name
      }
    }
    // Return the JSON response data
  } catch (error) {
    // Handle different types of errors
    if (error.code === "ECONNABORTED") {
      // Timeout error
      return { results: [], status: "TIME_OUT" };
    } else {
      console.error(`An error occurred: ${error.message}`);
      return { results: [], status: "ERROR", error: error.message };
    }
  }
}

function getLargerArray(arr1, arr2) {
  if (!arr1 && !arr2) return []; // Both are null/undefined
  if (!arr1) return arr2; // If only arr1 is null/undefined
  if (!arr2) return arr1; // If only arr2 is null/undefined
  return arr1.length > arr2.length ? arr1 : arr2;
}

function getLargerString(str1, str2) {
  if (!str1 && !str2) return null; // Both are null/undefined
  if (!str1) return str2; // If only str1 is null/undefined
  if (!str2) return str1; // If only str2 is null/undefined
  return str1.length > str2.length ? str1 : str2;
}

function getLargerNumber(num1, num2) {
  if (num1 == null && num2 == null) return 0; // Both are null/undefined
  if (num1 == null) return num2; // If only num1 is null/undefined
  if (num2 == null) return num1; // If only num2 is null/undefined
  return num1 > num2 ? num1 : num2;
}

// Export functions
module.exports = {
  getCandidates,
  syncCreateOrUpdateData,
  findElasticCandidate,
};
