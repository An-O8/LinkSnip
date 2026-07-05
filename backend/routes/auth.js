const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { loginLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')
const { signupSchema, loginSchema } = require('../validators/linkValidators')

// One token, 7 days, sent back in JSON, stored in localStorage on the frontend.
// Simple and fine for a portfolio project - the tradeoff is a stolen token stays
// valid until it expires. (The "correct" production fix is refresh tokens in
// httpOnly cookies - worth knowing about, not worth the complexity here.)
const createToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

router.post('/signup', validate(signupSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body

  const existing = await User.findOne({ email })
  if (existing) throw new ApiError(400, 'Email already in use.')

  const user = await User.create({ name, email, password })
  const token = createToken(user._id)

  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  })
}))

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body

  const user = await User.findOne({ email })
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, 'Invalid email or password.')
  }
  if (user.isBlocked) throw new ApiError(403, 'Your account has been blocked.')

  const token = createToken(user._id)
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  })
}))

router.get('/me', protect, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      apiKey: req.user.apiKey,
      username: req.user.username,
      customDomain: req.user.customDomain,
      bioBackgroundColor: req.user.bioBackgroundColor,
      bioBackgroundImage: req.user.bioBackgroundImage,
      socialLinks: req.user.socialLinks
    }
  })
})

// PATCH /api/auth/me - Update username / custom domain from Settings
router.patch('/me', protect, asyncHandler(async (req, res) => {
  const { username, customDomain, bioBackgroundColor, bioBackgroundImage, socialLinks } = req.body
  const update = {}

  if (bioBackgroundColor !== undefined) update.bioBackgroundColor = bioBackgroundColor
  if (bioBackgroundImage !== undefined) update.bioBackgroundImage = bioBackgroundImage || null
  if (socialLinks !== undefined) {
    update.socialLinks = {
      twitter: socialLinks.twitter || null,
      instagram: socialLinks.instagram || null,
      youtube: socialLinks.youtube || null,
      website: socialLinks.website || null
    }
  }

  if (username !== undefined) {
    const cleaned = username.trim().toLowerCase()
    if (cleaned && !/^[a-z0-9-_]{3,30}$/.test(cleaned)) {
      throw new ApiError(400, 'Username must be 3-30 characters: letters, numbers, - and _ only.')
    }
    if (cleaned) {
      const taken = await User.findOne({ username: cleaned, _id: { $ne: req.user._id } })
      if (taken) throw new ApiError(400, 'That username is already taken.')
    }
    update.username = cleaned || null
  }

  if (customDomain !== undefined) {
    update.customDomain = customDomain ? customDomain.trim().toLowerCase() : null
  }

  const updated = await User.findByIdAndUpdate(req.user._id, update, { new: true })
  res.json({
    message: 'Settings updated!',
    user: {
      username: updated.username,
      customDomain: updated.customDomain,
      bioBackgroundColor: updated.bioBackgroundColor,
      bioBackgroundImage: updated.bioBackgroundImage,
      socialLinks: updated.socialLinks
    }
  })
}))

router.post('/generate-api-key', protect, asyncHandler(async (req, res) => {
  const apiKey = 'sk_' + crypto.randomBytes(24).toString('hex')
  await User.findByIdAndUpdate(req.user._id, { apiKey })
  res.json({ apiKey })
}))

module.exports = router