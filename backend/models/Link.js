const mongoose = require('mongoose')

// For basic A/B / rotation links: each destination gets a % weight.
// Weights should sum to 100 (validated in the route, not here, so partial
// saves during editing don't get rejected by Mongoose).
const rotationDestinationSchema = new mongoose.Schema({
  url: { type: String, required: true },
  weight: { type: Number, required: true, min: 1, max: 100 }
}, { _id: false })

const linkSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortCode: { type: String, required: true, unique: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = guest link (created from homepage, no account)
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  password: { type: String, default: null },     // hashed, only set if link is protected
  expiresAt: { type: Date, default: null },
  isOneTime: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },     // soft delete flag
  isPublic: { type: Boolean, default: false },     // shown on the owner's /bio page
  clickCount: { type: Number, default: 0 },

  // Rotation / A/B testing - if present and non empty, redirectController picks
  // a destination by weighted random instead of using originalUrl directly.
  rotationDestinations: { type: [rotationDestinationSchema], default: [] },
  rotationEnabled: { type: Boolean, default: false }
}, { timestamps: true })

linkSchema.index({ userId: 1, folderId: 1 })
linkSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Link', linkSchema)