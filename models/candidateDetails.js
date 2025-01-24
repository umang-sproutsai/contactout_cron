const mongoose = require('mongoose');

// Define a schema for the `candidate_details` collection
const CandidateDetailsSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    vendor: { type: String, required: true },
    first_name: { type: String, required: true },
    title: { type: String, required: false },
    industry: { type: String, required: false },
    location: { type: Array, required: false },
    skills: { type: Array, required: false },
    updated_at: { type: Date, required: false },
    experience: { type: Array, required: false },
    education: { type: Array, required: false },
    status_code: { type: Number, required: false },
    remote_data: { type: Object, required: false },
    email: { type: Array, required: false },
    phone: { type: Array, required: false },
    linkedin: { type: String, required: false },
    job: { type: String, required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Candidate' },
  },
  {
    timestamps: true,
    collection: 'candidate_details',
  }
);

module.exports = mongoose.model('CandidateDetails', CandidateDetailsSchema);
