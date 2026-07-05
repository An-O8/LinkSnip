const mongoose = require('mongoose')

// One document per click - this is what powers the analytics dashboard
const clickSchema = new mongoose.Schema({
  linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true },
  shortCode: { type: String, required: true },   // duplicated here so analytics queries are faster
  referrer: { type: String, default: 'Direct' },
  device: { type: String, default: 'Unknown' },  // "Mobile" | "Desktop" | "Tablet"
  browser: { type: String, default: 'Unknown' },
  os: { type: String, default: 'Unknown' },
  country: { type: String, default: 'Unknown' },
  ip: { type: String, default: null }
}, { timestamps: true }) // createdAt = exact click time

module.exports = mongoose.model('Click', clickSchema)
