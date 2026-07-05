// A custom error you can throw anywhere: throw new ApiError(404, 'Link not found')
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true // marks this as an "expected" error, not a bug
  }
}

// Wraps an async route so you don't need try/catch in every single handler.
// If the wrapped function throws (or rejects), the error is passed to errorHandler.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Catches any request that didn't match a route
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found.`))
}

// The single place every error in the app ends up. Mount this LAST, after all routes.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500

  // Mongoose validation errors - readable messages instead of a raw stack trace
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed.',
      details: Object.values(err.errors).map(e => e.message)
    })
  }
  // Duplicate key error (ex - email or shortCode already taken)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field'
    return res.status(409).json({ message: `${field} already exists.` })
  }
  // Malformed MongoDB ObjectId in a URL param
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format.' })
  }

  if (!err.isOperational) {
    console.error('Unexpected error:', err) // this is a bug — log it loudly
  }

  res.status(statusCode).json({
    message: err.isOperational ? err.message : 'Something went wrong on our end.'
  })
}

module.exports = { ApiError, asyncHandler, notFound, errorHandler }
