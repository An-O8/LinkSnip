require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const mongoose = require('mongoose')

const authRoutes = require('./routes/auth')
const linkRoutes = require('./routes/links')
const analyticsRoutes = require('./routes/analytics')
const adminRoutes = require('./routes/admin')
const bioRoutes = require('./routes/bio')
const folderRoutes = require('./routes/folders')
const redirect = require('./controllers/redirectController')
const { errorHandler, notFound } = require('./middleware/errorHandler')

const app = express()

app.use(cors())
app.use(express.json())

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/links', linkRoutes)      // includes /api/links/guest (no-login shorten)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/bio', bioRoutes)
app.use('/api/folders', folderRoutes)

// ── Serve the frontend (vanilla HTML/CSS/JS) ────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')))
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')))

// Pretty URL for link-in-bio pages: /bio/anurag -> /pages/bio.html?u=anurag
// (the actual page is a static file that reads the username from the query string)
app.get('/bio/:username', (req, res) => res.redirect(`/pages/bio.html?u=${req.params.username}`))

// ── The actual URL shortener redirect — must come AFTER static/API routes ──
// so it only catches short codes, not real file/API paths.
app.get('/:code', redirect)

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`LinkSnip running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })