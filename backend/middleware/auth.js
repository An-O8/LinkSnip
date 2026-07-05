const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Runs before any protected route - checks for a valid JWT in the Authorization header
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not logged in. Please login first.' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id).select('-password')
    if (!user) return res.status(401).json({ message: 'User not found.' })
    if (user.isBlocked) return res.status(403).json({ message: 'Your account has been blocked.' })

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please login again.' })
  }
}

// For admin only routes - must run AFTER protect
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' })
  }
  next()
}

// Lets developers authenticate with an API key instead of a JWT (for programmatic use)
const protectOrApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key']

  if (apiKey) {
    const user = await User.findOne({ apiKey }).select('-password')
    if (!user || user.isBlocked) return res.status(401).json({ message: 'Invalid API key.' })
    req.user = user
    return next()
  }

  return protect(req, res, next)
}

module.exports = { protect, adminOnly, protectOrApiKey }
