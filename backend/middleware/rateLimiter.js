const rateLimit = require('express-rate-limit')

const createLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { message: 'Too many links created. Try again after an hour.' }
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many login attempts. Try again after 15 minutes.' }
})

const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { message: 'API rate limit exceeded. Try again later.' }
})

module.exports = { createLinkLimiter, loginLimiter, apiLimiter }
