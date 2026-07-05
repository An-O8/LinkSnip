const UAParser = require('ua-parser-js')
const bcrypt = require('bcryptjs')
const path = require('path')
const geoip = require('geoip-lite')
const Link = require('../models/Link')
const Click = require('../models/Click')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')

// Weighted random pick among rotation destinations, e.g. [{url:A, weight:70}, {url:B, weight:30}]
const pickRotationDestination = (destinations) => {
  const total = destinations.reduce((sum, d) => sum + d.weight, 0)
  let roll = Math.random() * total
  for (const dest of destinations) {
    roll -= dest.weight
    if (roll <= 0) return dest.url
  }
  return destinations[destinations.length - 1].url
}

// This runs every time someone visits a short link
const redirect = asyncHandler(async (req, res) => {
  const { code } = req.params

  // 1. Find the link
  const link = await Link.findOne({ shortCode: code, isActive: true })
  if (!link) {
    return res.status(404).sendFile(path.join(__dirname, '../../frontend/pages/404.html'))
  }

  // 2. Check expiry
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
    link.isActive = false
    await link.save()
    throw new ApiError(410, 'This link has expired.')
  }

  // 3. Check password protection
  if (link.password) {
    const { pwd } = req.query
    if (!pwd) return res.redirect(`/pages/password.html?code=${code}`)
    const isCorrect = await bcrypt.compare(pwd, link.password)
    if (!isCorrect) throw new ApiError(401, 'Wrong password.')
  }

  // 4. Parse device info from the user agent header
  const ua = UAParser(req.headers['user-agent'] || '')
  const device = ua.device.type === 'mobile' ? 'Mobile'
               : ua.device.type === 'tablet' ? 'Tablet'
               : 'Desktop'

  // 5. Log the click - don't block the redirect waiting for this to finish
  const geo = req.ip ? geoip.lookup(req.ip) : null

  Click.create({
    linkId: link._id,
    shortCode: code,
    referrer: req.headers.referer || 'Direct',
    device,
    browser: ua.browser.name || 'Unknown',
    os: ua.os.name || 'Unknown',
    country: geo?.country || 'Unknown',
    ip: req.ip
  }).catch(err => console.error('Click save failed:', err))

  // 6. Increment click count
  Link.findByIdAndUpdate(link._id, { $inc: { clickCount: 1 } }).catch(() => {})

  // 7. Deactivate if one time
  if (link.isOneTime) {
    link.isActive = false
    link.save().catch(() => {})
  }

  // 8. Resolve the destination - rotation aware
  const destination = (link.rotationEnabled && link.rotationDestinations?.length >= 2)
    ? pickRotationDestination(link.rotationDestinations)
    : link.originalUrl

  res.redirect(301, destination)
})

module.exports = redirect