const { z } = require('zod')

const rotationDestinationSchema = z.object({
  url: z.string().url('Each rotation destination must be a valid URL.'),
  weight: z.number().min(1).max(100)
})

const createLinkSchema = z.object({
  originalUrl: z.string().url('Must be a valid URL starting with http:// or https://'),
  customAlias: z.string()
    .trim()
    .min(3, 'Alias must be at least 3 characters.')
    .max(30, 'Alias must be under 30 characters.')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Alias can only contain letters, numbers, - and _.')
    .optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  password: z.string().min(4, 'Password must be at least 4 characters.').optional(),
  isOneTime: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().max(30)).max(10, 'Max 10 tags.').optional().default([]),
  isPublic: z.boolean().optional().default(false),
  folderId: z.string().nullable().optional(),
  utmSource: z.string().trim().max(50).optional(),
  utmMedium: z.string().trim().max(50).optional(),
  utmCampaign: z.string().trim().max(50).optional(),
  rotationEnabled: z.boolean().optional().default(false),
  rotationDestinations: z.array(rotationDestinationSchema).max(5, 'Max 5 rotation destinations.').optional().default([])
}).refine(data => {
  if (!data.rotationEnabled) return true
  const total = data.rotationDestinations.reduce((sum, d) => sum + d.weight, 0)
  return data.rotationDestinations.length >= 2 && total === 100
}, { message: 'Rotation needs at least 2 destinations with weights summing to 100.', path: ['rotationDestinations'] })

// Bulk creation - paste a list of URLs, one per line, get short links back for all of them.
// Kept intentionally simple: no aliases/passwords/rotation per URL, just quick shortening.
const bulkCreateSchema = z.object({
  urls: z.array(z.string().url('One of the URLs is invalid.'))
    .min(1, 'Provide at least one URL.')
    .max(50, 'Max 50 URLs at a time.'),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional().default([])
})

const updateLinkSchema = z.object({
  originalUrl: z.string().url().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isPublic: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
  rotationEnabled: z.boolean().optional(),
  rotationDestinations: z.array(rotationDestinationSchema).max(5).optional()
})

// Guest, no login quick shorten from the homepage - deliberately limited
// (no alias, no password, no expiry) since there's no account to manage it later.
const guestCreateSchema = z.object({
  originalUrl: z.string().url('Must be a valid URL starting with http:// or https://')
})

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.')
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required.')
})

module.exports = {
  createLinkSchema,
  updateLinkSchema,
  bulkCreateSchema,
  guestCreateSchema,
  signupSchema,
  loginSchema
}