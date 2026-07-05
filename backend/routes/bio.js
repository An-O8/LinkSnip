const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Link = require('../models/Link')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')

// ─── GET /api/bio/:username — Public, no auth. Powers the /bio/:username page ─
router.get('/:username', asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() })
  if (!user) throw new ApiError(404, 'This page does not exist.')

  const links = await Link.find({ userId: user._id, isActive: true, isPublic: true })
    .sort({ createdAt: -1 })
    .select('shortCode tags createdAt')

  res.json({
    name: user.name,
    backgroundColor: user.bioBackgroundColor,
    backgroundImage: user.bioBackgroundImage,
    socialLinks: user.socialLinks,
    links: links.map(l => ({
      shortCode: l.shortCode,
      shortUrl: `${process.env.BASE_URL}/${l.shortCode}`,
      tags: l.tags
    }))
  })
}))

module.exports = router