# LinkSnip

A full stack URL shortener with authentication, click analytics, QR codes, folders and A/B link rotation.

Built with Node.js, Express, and MongoDB on the backend, and vanilla HTML/CSS/JS on the frontend - no framework, no build step.

## Features

- Short links with custom aliases, expiry dates, password protection, and one time use
- Guest shortening - anyone can shorten a URL from the homepage without an account
- Bulk creation - paste multiple URLs at once
- Folders - organize links into groups, move or delete several at once
- A/B link rotation - one short link splits traffic across multiple destinations by weight
- UTM builder - source/medium/campaign get baked into the destination URL automatically
- Live link preview - see a URL's title and description before shortening it
- Search and pagination on the dashboard
- Click analytics - device, browser, OS, country, and referrer, charted, with CSV export and a live updating click counter
- QR codes - PNG or SVG, adjustable size, optional logo overlay
- Public bio page (`/bio/username`) with a custom background and social links
- Dark mode with persisted preference
- Developer API with API-key authentication
- Admin panel - block users, moderate links

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcrypt |
| Validation | Zod |
| Geo lookup | geoip-lite (offline) |
| QR codes | `qrcode`, `sharp` |
| Frontend | Vanilla HTML/CSS/JS |

## How authentication works

Signup and login return a JWT signed with `JWT_SECRET`, valid for 7 days. The frontend stores it in `localStorage` and sends it as `Authorization: Bearer <token>` on every request. The `protect` middleware verifies the token, loads the user, and rejects the request if the token is invalid, expired or the user is blocked.

## How a redirect works

The core logic lives in `controllers/redirectController.js`:

1. A visitor hits `yoursite.com/abc123`
2. Look up `abc123` in MongoDB - if it doesn't exist or is inactive, show a 404
3. If it's expired, deactivate it and return an error instead of redirecting
4. If it's password-protected and no password was given, redirect to the password page
5. Log the click (device, browser, referrer, country) as a fire and forget write - this never blocks the redirect
6. Increment the click counter
7. If it's a one time link, deactivate it right after this use
8. If rotation is enabled with two or more weighted destinations, pick one (see below)
9. Send a 301 redirect to the resolved URL

## How link rotation picks a destination

Each destination has a weight, e.g. `[{ url: A, weight: 70 }, { url: B, weight: 30 }]`. On every click:

```js
let roll = Math.random() * totalWeight
for (const dest of destinations) {
  roll -= dest.weight
  if (roll <= 0) return dest.url
}
```

This is weighted random selection, not round robin - any single click is genuinely random, but across many clicks the split converges toward the configured weights. Weights must sum to 100; this is checked in the browser for instant feedback and enforced server side with Zod.

## Project structure

```
backend/
  server.js
  models/        User, Link, Click, Folder
  routes/        auth, links, analytics, admin, bio, folders
  controllers/   redirectController.js
  middleware/    auth, error handling, rate limiting, validation
  validators/    Zod schemas

frontend/
  index.html     includes the guest-shorten box
  pages/         dashboard, login, signup, analytics, qr, settings, bio, admin
  js/api.js      shared fetch wrapper, toast and theme helpers
  css/style.css
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=any_long_random_string
BASE_URL=http://localhost:5000
```

Start the server:

```bash
npm run dev
```

Requires a running MongoDB instance - local install or a free MongoDB Atlas cluster. `sharp`, used for QR logo compositing, installs a prebuilt binary automatically on `npm install`.

Open `http://localhost:5000`.

`BASE_URL` determines the domain shown on generated short links - it needs to point to wherever the app is actually reachable (a deployment, or a tunnel like ngrok) for links to work outside your own machine.

## What's next

- Redis caching on the redirect path
- Move click logging into a background queue
- Refresh tokens instead of a single long lived JWT
- Real DNS based custom domains, beyond the current display-only version
- Per destination analytics for rotation links