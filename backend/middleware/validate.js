// Wraps a Zod schema as Express middleware.
// Usage: router.post('/', validate(createLinkSchema), asyncHandler(handler))
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source])

  if (!result.success) {
    const details = result.error.issues.map(i => ({
      field: i.path.join('.'),
      message: i.message
    }))
    return res.status(400).json({ message: 'Validation failed.', details })
  }

  req[source] = result.data // parsed + defaulted values
  next()
}

module.exports = validate
