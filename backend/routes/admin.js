const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Link = require('../models/Link')
const Click = require('../models/Click')
const { protect, adminOnly } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')

router.use(protect, adminOnly) // every route below requires an admin

router.get('/stats', asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments()
  const totalLinks = await Link.countDocuments({ isActive: true })
  const totalClicks = await Click.countDocuments()

  const since = new Date()
  since.setDate(since.getDate() - 7)
  const clicksThisWeek = await Click.countDocuments({ createdAt: { $gte: since } })

  res.json({ totalUsers, totalLinks, totalClicks, clicksThisWeek })
}))

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 })
  res.json({ users })
}))

router.patch('/users/:id/block', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })

  user.isBlocked = !user.isBlocked
  await user.save()
  res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}.`, isBlocked: user.isBlocked })
}))

router.get('/links', asyncHandler(async (req, res) => {
  const links = await Link.find({ isActive: true })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(100)
  res.json({ links })
}))

router.delete('/links/:id', asyncHandler(async (req, res) => {
  await Link.findByIdAndUpdate(req.params.id, { isActive: false })
  res.json({ message: 'Link removed.' })
}))

module.exports = router
