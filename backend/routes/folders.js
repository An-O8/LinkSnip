const express = require('express')
const router = express.Router()
const Folder = require('../models/Folder')
const Link = require('../models/Link')
const { protect } = require('../middleware/auth')
const { asyncHandler, ApiError } = require('../middleware/errorHandler')

// GET /api/folders = list folders with link counts
router.get('/', protect, asyncHandler(async (req, res) => {
  const folders = await Folder.find({ userId: req.user._id }).sort({ name: 1 })

  const counts = await Link.aggregate([
    { $match: { userId: req.user._id, isActive: true, folderId: { $ne: null } } },
    { $group: { _id: '$folderId', count: { $sum: 1 } } }
  ])
  const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.count]))

  res.json({
    folders: folders.map(f => ({
      id: f._id,
      name: f.name,
      color: f.color,
      linkCount: countMap[String(f._id)] || 0
    }))
  })
}))

// POST /api/folders = create a folder
router.post('/', protect, asyncHandler(async (req, res) => {
  const { name, color } = req.body
  if (!name || !name.trim()) throw new ApiError(400, 'Folder name is required.')

  const folder = await Folder.create({
    name: name.trim(),
    color: color || '#5b4ff5',
    userId: req.user._id
  })

  res.status(201).json({ folder: { id: folder._id, name: folder.name, color: folder.color, linkCount: 0 } })
}))

// PATCH /api/folders/:id = rename / recolor
router.patch('/:id', protect, asyncHandler(async (req, res) => {
  const folder = await Folder.findOne({ _id: req.params.id, userId: req.user._id })
  if (!folder) throw new ApiError(404, 'Folder not found.')

  if (req.body.name !== undefined) folder.name = req.body.name.trim()
  if (req.body.color !== undefined) folder.color = req.body.color

  await folder.save()
  res.json({ message: 'Folder updated.', folder: { id: folder._id, name: folder.name, color: folder.color } })
}))

// DELETE /api/folders/:id = delete folder, unassign its links (not delete them)   
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const folder = await Folder.findOne({ _id: req.params.id, userId: req.user._id })
  if (!folder) throw new ApiError(404, 'Folder not found.')

  await Link.updateMany({ folderId: folder._id, userId: req.user._id }, { folderId: null })
  await folder.deleteOne()

  res.json({ message: 'Folder deleted. Its links were kept and moved to Uncategorized.' })
}))

module.exports = router