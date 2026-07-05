# 🔗 LinkSnip

A full-stack URL shortener with authentication, analytics, QR codes, and an admin panel — built with Node.js, Express, MongoDB, and vanilla JavaScript.

## What it does

- **Sign up / log in** with a JWT-based auth system
- **Create short links** with optional custom aliases, expiry dates, password protection, and one-time-use
- **UTM campaign builder** — add source/medium/campaign when creating a link; they get baked into the destination URL automatically
- **Live link preview** — paste a URL and see its title/description before creating the link
- **Track clicks** — device, browser, OS, referrer, and **country** (via offline geoip-lite lookup), visualized with Chart.js
- **Export click data as CSV** from the analytics page
- **QR codes** — with optional logo overlay in the center
- **Public bio page** (`/bio/yourusername`) — a link-in-bio style page listing any links you mark "public"
- **Custom domain (display-only)** — set a domain in Settings and your short links will display under that domain
- **Dark mode** with persisted preference, toast notifications instead of browser `alert()`
- **Tag filtering** on the dashboard, in addition to text search
- **Developer API** — create links programmatically using an API key
- **Admin panel** — manage users (block/unblock) and moderate all links

## Tech stack

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Auth:** JWT (JSON Web Tokens), bcrypt for password hashing
- **Validation:** Zod — every request body is checked against a schema before touching the database
- **Geo lookup:** geoip-lite — offline, no external API calls or rate limits
- **QR codes:** `qrcode` + `sharp` for logo compositing
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework — this was a deliberate choice, see below)

## Why no React?

This project intentionally uses vanilla JS instead of React. Two reasons:

1. **Depth over breadth.** A URL shortener's real engineering challenges — short code collisions, auth, rate limiting, click tracking — are backend problems. Adding a frontend framework wouldn't make those parts better; it would just add more surface area to learn at once.
2. **Every line here is something I can explain.** I'd rather have a smaller project I fully understand than a bigger one with parts I copy-pasted and can't defend in an interview.

## Project structure

```
backend/
  server.js              # entry point — wires everything together
  models/                # Mongoose schemas: User, Link, Click
  routes/                # Express routers: auth, links, analytics, admin, bio
  controllers/
    redirectController.js  # the actual "shortener" logic — see below
  middleware/
    auth.js               # JWT verification
    errorHandler.js       # centralized error handling
    validate.js            # Zod validation middleware
    rateLimiter.js         # prevents abuse (e.g. brute-forcing login)
  validators/             # Zod schemas — what a valid request looks like

frontend/
  index.html
  pages/                  # dashboard, login, signup, analytics, admin, bio, etc.
  js/api.js               # one shared fetch wrapper, toast/theme helpers, used by every page
  css/style.css           # includes dark mode variables + toast styles
```

## How a redirect actually works (the core of the whole project)

This is `controllers/redirectController.js` — the file every URL shortener interview question is really asking about:

1. Someone visits `yoursite.com/abc123`
2. Look up `abc123` in MongoDB — does an active link with that code exist?
3. If not → show a 404 page
4. If it exists but is expired → deactivate it, return an error
5. If it's password-protected and no password was given → redirect to the password entry page
6. Log the click (device/browser/referrer/country) — this doesn't block the redirect; if it fails, the user still gets sent to their destination
7. Increment the click counter
8. If it's a one-time link, deactivate it now
9. Send a `301 redirect` to the real URL

## Setup

```bash
cd backend
npm install
cp .env.example .env    # fill in MONGO_URI and a JWT_SECRET
npm run dev
```

Requires a running MongoDB instance (local install or a free MongoDB Atlas cluster). `sharp` (used for QR logo overlays) installs a prebuilt binary automatically on `npm install` — no extra setup needed on Windows/Mac/Linux.

Then open `http://localhost:5000` in your browser.

## Notes on a couple of features, so you can explain them honestly

- **Country lookup** uses `geoip-lite`, an offline database — it won't resolve `127.0.0.1`/localhost correctly since that's not a real public IP. Test it by deploying, or by manually inserting a Click document with a real public IP.
- **Custom domain** is display-only in this version: it changes what URL is *shown* to the user, but the actual redirect still runs on this server's own domain. Making a genuinely separate domain redirect through this server would require DNS configuration (pointing that domain's A/CNAME record here) — real, but infrastructure work outside the codebase itself. Good to say exactly this if asked in an interview.
- **Link-in-bio** pages are public and unauthenticated by design (that's the point — anyone with the link should see them), so `/api/bio/:username` deliberately has no `protect` middleware.

## What I'd add next (if I were continuing this)

- Redis caching on the redirect path (currently every redirect hits MongoDB directly — fine at small scale, would need caching at real traffic)
- Move click-logging off the request path into a background job queue
- Refresh tokens instead of one long-lived JWT
- Actual DNS-based custom domain redirects, not just display

These are deliberately left out for now — they're real production concerns, but adding them before I could explain the ones already here would make this project harder to defend, not stronger.
