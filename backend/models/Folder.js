const mongoose = require('mongoose')

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  color: { type: String, default: '#5b4ff5' }, // hex, used as a little swatch in the UI
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

// A user can't have two folders with the same name
folderSchema.index({ userId: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('Folder', folderSchema)
