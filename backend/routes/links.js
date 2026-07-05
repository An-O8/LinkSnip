const express = require('express')
const router = express.Router()
const { nanoid } = require('nanoid')
const QRCode = require('qrcode')
const sharp = require('sharp')
const bcrypt = require('bcryptjs')
const Link = require('../models/Link')
const { protect, protectOrApiKey } = require('../middleware/auth')
const { createLinkLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')
const { createLinkSchema, updateLinkSchema, bulkCreateSchema, guestCreateSchema } = require('../validators/linkValidators')

// Respects a user's custom domain if they've set one in Setting otherwise
// falls back to the app's own BASE_URL.
const buildShortUrl = (user, shortCode) => {
  if (user?.customDomain) return `https://${user.customDomain}/${shortCode}`
  return `${process.env.BASE_URL}/${shortCode}`
}

const shapeLink = (link, user) => ({
  id: link._id,
  originalUrl: link.originalUrl,
  shortCode: link.shortCode,
  shortUrl: buildShortUrl(user, link.shortCode),
  clickCount: link.clickCount,
  expiresAt: link.expiresAt,
  isOneTime: link.isOneTime,
  tags: link.tags,
  isPublic: link.isPublic,
  folderId: link.folderId,
  hasPassword: !!link.password,
  rotationEnabled: link.rotationEnabled,
  rotationDestinations: link.rotationDestinations,
  createdAt: link.createdAt
})

// POST /api/links - Create a new short link
router.post('/', protectOrApiKey, createLinkLimiter, validate(createLinkSchema), asyncHandler(async (req, res) => {
  const { originalUrl, customAlias, expiresAt, password, isOneTime, tags, isPublic, folderId,
          utmSource, utmMedium, utmCampaign, rotationEnabled, rotationDestinations } = req.body

  const shortCode = customAlias || nanoid(6)

  const existing = await Link.findOne({ shortCode })
  if (existing) throw new ApiError(400, 'This alias is already taken. Try another one.')

  const hashedPassword = password ? await bcrypt.hash(password, 10) : null

  // Bake UTM params into the destination URL itself, so when someone lands on
  // the final page, the site's own analytics (ex -  Google Analytics) picks up
  // the campaign attribution automatically.
  let finalUrl = originalUrl
  if (utmSource || utmMedium || utmCampaign) {
    const urlObj = new URL(originalUrl)
    if (utmSource) urlObj.searchParams.set('utm_source', utmSource)
    if (utmMedium) urlObj.searchParams.set('utm_medium', utmMedium)
    if (utmCampaign) urlObj.searchParams.set('utm_campaign', utmCampaign)
    finalUrl = urlObj.toString()
  }

  const link = await Link.create({
    originalUrl: finalUrl,
    shortCode,
    userId: req.user._id,
    folderId: folderId || null,
    password: hashedPassword,
    expiresAt: expiresAt || null,
    isOneTime,
    tags,
    isPublic,
    rotationEnabled,
    rotationDestinations
  })

  res.status(201).json({ message: 'Link created!', link: shapeLink(link, req.user) })
}))

// POST /api/links/bulk - Create many links at once from pasted URLs 
router.post('/bulk', protect, createLinkLimiter, validate(bulkCreateSchema), asyncHandler(async (req, res) => {
  const { urls, folderId, tags } = req.body

  const results = []
  for (const originalUrl of urls) {
    try {
      const shortCode = nanoid(6)
      const link = await Link.create({
        originalUrl,
        shortCode,
        userId: req.user._id,
        folderId: folderId || null,
        tags
      })
      results.push({ ok: true, originalUrl, link: shapeLink(link, req.user) })
    } catch (err) {
      results.push({ ok: false, originalUrl, message: 'Could not shorten this URL.' })
    }
  }

  const successCount = results.filter(r => r.ok).length
  res.status(201).json({
    message: `${successCount} of ${urls.length} links created.`,
    results
  })
}))

// POST /api/links/guest - No login quick shorten from the homepage 
// Deliberately bare bones: no auth, so no folder/password/expiry/rotation
// Rate limited hard since there's no account to throttle by.
router.post('/guest', createLinkLimiter, validate(guestCreateSchema), asyncHandler(async (req, res) => {
  const { originalUrl } = req.body
  const shortCode = nanoid(7) // one char longer than authed links, keeps them visually distinct

  const link = await Link.create({
    originalUrl,
    shortCode,
    userId: null,
    isPublic: false
  })

  res.status(201).json({
    message: 'Link created! Sign up to track clicks and manage it.',
    shortUrl: `${process.env.BASE_URL}/${link.shortCode}`,
    shortCode: link.shortCode
  })
}))

// GET /api/links - Get all links for logged-in user (search + pagination) 
router.get('/', protect, asyncHandler(async (req, res) => {
  const { q, folderId, page = 1, limit = 20 } = req.query
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))

  const filter = { userId: req.user._id, isActive: true }
  if (folderId) filter.folderId = folderId === 'none' ? null : folderId
  if (q) {
    filter.$or = [
      { originalUrl: { $regex: q, $options: 'i' } },
      { shortCode: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } }
    ]
  }

  const total = await Link.countDocuments(filter)
  const links = await Link.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)

  res.json({
    links: links.map(l => shapeLink(l, req.user)),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  })
}))

// PATCH /api/links/:id - Edit a link's destination or details 
router.patch('/:id', protect, validate(updateLinkSchema), asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found.')

  const { originalUrl, tags, expiresAt, folderId, rotationEnabled, rotationDestinations } = req.body
  if (originalUrl) link.originalUrl = originalUrl
  if (tags !== undefined) link.tags = tags
  if (expiresAt !== undefined) link.expiresAt = expiresAt
  if (req.body.isPublic !== undefined) link.isPublic = req.body.isPublic
  if (folderId !== undefined) link.folderId = folderId || null
  if (rotationEnabled !== undefined) link.rotationEnabled = rotationEnabled
  if (rotationDestinations !== undefined) link.rotationDestinations = rotationDestinations

  if (link.rotationEnabled) {
    const total = link.rotationDestinations.reduce((s, d) => s + d.weight, 0)
    if (link.rotationDestinations.length < 2 || total !== 100) {
      throw new ApiError(400, 'Rotation needs at least 2 destinations with weights summing to 100.')
    }
  }

  await link.save()
  res.json({ message: 'Link updated!', link: shapeLink(link, req.user) })
}))

// DELETE /api/links/:id - Soft delete a link
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found.')

  link.isActive = false
  await link.save()
  res.json({ message: 'Link deleted.' })
}))

// POST /api/links/bulk delete - Delete several links at once 
router.post('/bulk-delete', protect, asyncHandler(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, 'Provide a list of link IDs.')

  const result = await Link.updateMany(
    { _id: { $in: ids }, userId: req.user._id },
    { isActive: false }
  )
  res.json({ message: `${result.modifiedCount} link(s) deleted.` })
}))

// POST /api/links/bulk move - Move several links into a folder
router.post('/bulk-move', protect, asyncHandler(async (req, res) => {
  const { ids, folderId } = req.body
  if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, 'Provide a list of link IDs.')

  const result = await Link.updateMany(
    { _id: { $in: ids }, userId: req.user._id },
    { folderId: folderId || null }
  )
  res.json({ message: `${result.modifiedCount} link(s) moved.` })
}))

// GET /api/links/:id/qr - Generate QR code for a link 
// Supports shape (square/dots/rounded - via QRCode's built in rendering options
// where possible), custom size and SVG or PNG output.
router.get('/:id/qr', protect, asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found.')

  const shortUrl = buildShortUrl(req.user, link.shortCode)
  const { color = '000000', bg = 'ffffff', logoUrl, size = 400, format = 'png' } = req.query
  const qrSize = Math.min(1000, Math.max(150, parseInt(size) || 400))

  if (format === 'svg') {
    const svg = await QRCode.toString(shortUrl, {
      type: 'svg',
      color: { dark: '#' + color, light: '#' + bg },
      width: qrSize,
      margin: 2
    })
    return res.json({ qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, shortUrl })
  }

  // Higher error correction (H) leaves enough redundancy in the QR pattern
  // that covering the center with a logo doesn't break scannability.
  const qrBuffer = await QRCode.toBuffer(shortUrl, {
    color: { dark: '#' + color, light: '#' + bg },
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: logoUrl ? 'H' : 'M'
  })

  let finalBuffer = qrBuffer

  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl)
      if (!logoRes.ok) throw new Error('Could not fetch logo image.')
      const logoBuffer = Buffer.from(await logoRes.arrayBuffer())

      // Logo sized to ~20% of the QR - big enough to be visible, small enough
      // that the H level error correction can still recover the covered modules.
      const logoSize = Math.round(qrSize * 0.2)
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer()

      finalBuffer = await sharp(qrBuffer)
        .composite([{ input: resizedLogo, gravity: 'center' }])
        .png()
        .toBuffer()
    } catch (err) {
      // If the logo fails to load/composite, fall back to a plain QR rather than erroring out
      finalBuffer = qrBuffer
    }
  }

  const qrDataUrl = `data:image/png;base64,${finalBuffer.toString('base64')}`
  res.json({ qr: qrDataUrl, shortUrl })
}))

// GET /api/links/preview?url=... - Fetch title/description for a URL 
router.get('/preview', protect, asyncHandler(async (req, res) => {
  const { url } = req.query
  if (!url) throw new ApiError(400, 'A url query param is required.')

  try {
    new URL(url) // throws if malformed
  } catch {
    throw new ApiError(400, 'Invalid URL.')
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const pageRes = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'LinkSnip-Preview-Bot' } })
    clearTimeout(timeout)

    const html = await pageRes.text()

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)

    res.json({
      title: titleMatch ? titleMatch[1].trim().slice(0, 200) : null,
      description: descMatch ? descMatch[1].trim().slice(0, 300) : null
    })
  } catch (err) {
    res.json({ title: null, description: null })
  }
}))

module.exports = router