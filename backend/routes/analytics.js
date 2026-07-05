const express = require('express')
const router = express.Router()
const Click = require('../models/Click')
const Link = require('../models/Link')
const { protect } = require('../middleware/auth')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')

// GET /api/analytics/:linkId - Full analytics for one link
router.get('/:linkId', protect, asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.linkId, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found.')

  const days = parseInt(req.query.days) || 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  const clicks = await Click.find({ linkId: link._id, createdAt: { $gte: since } })

  // Clicks per day
  const clicksByDay = {}
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    clicksByDay[d.toISOString().split('T')[0]] = 0
  }
  clicks.forEach(click => {
    const key = click.createdAt.toISOString().split('T')[0]
    if (clicksByDay[key] !== undefined) clicksByDay[key]++
  })

  const tally = (field) => clicks.reduce((map, c) => {
    map[c[field]] = (map[c[field]] || 0) + 1
    return map
  }, {})

  res.json({
    totalClicks: link.clickCount,
    clicksInRange: clicks.length,
    clicksByDay,
    devices: tally('device'),
    browsers: tally('browser'),
    referrers: tally('referrer'),
    countries: tally('country')
  })
}))

// GET /api/analytics = Overview stats for all user's links 
router.get('/', protect, asyncHandler(async (req, res) => {
  const links = await Link.find({ userId: req.user._id, isActive: true })
  const linkIds = links.map(l => l._id)

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const totalClicks = links.reduce((sum, l) => sum + l.clickCount, 0)
  const recentClicks = await Click.countDocuments({ linkId: { $in: linkIds }, createdAt: { $gte: since } })

  const topLinks = [...links]
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 5)
    .map(l => ({ shortCode: l.shortCode, originalUrl: l.originalUrl, clickCount: l.clickCount }))

  res.json({
    totalLinks: links.length,
    totalClicks,
    clicksLast30Days: recentClicks,
    topLinks
  })
}))

// GET /api/analytics/:linkId/export = Download clicks as CSV 
router.get('/:linkId/export', protect, asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.linkId, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found.')

  const clicks = await Click.find({ linkId: link._id }).sort({ createdAt: -1 })

  const header = 'Date,Device,Browser,OS,Country,Referrer\n'
  const rows = clicks.map(c => {
    const date = c.createdAt.toISOString()
    // Wrap fields in quotes in case a referrer URL contains a comma
    return [date, c.device, c.browser, c.os, c.country, c.referrer]
      .map(field => `"${String(field).replace(/"/g, '""')}"`)
      .join(',')
  }).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${link.shortCode}-clicks.csv"`)
  res.send(header + rows)
}))

module.exports = router
