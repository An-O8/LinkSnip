const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBlocked: { type: Boolean, default: false },
  apiKey: { type: String, unique: true, sparse: true }, // sparse allows multiple nulls
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true }, // for /bio/:username
  customDomain: { type: String, default: null, trim: true },

  // Bio page customization
  bioBackgroundColor: { type: String, default: '#5b4ff5' },
  bioBackgroundImage: { type: String, default: null }, // URL to a cover image, optional
  socialLinks: {
    twitter: { type: String, default: null },
    instagram: { type: String, default: null },
    youtube: { type: String, default: null },
    website: { type: String, default: null }
  }
}, { timestamps: true })

// Hash the password automatically whenever it's set or changed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.isPasswordCorrect = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('User', userSchema)