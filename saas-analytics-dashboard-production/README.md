# ⚡ PulseBoard — Modular SaaS Analytics Dashboard

PulseBoard is a framework-free Single Page Application (SPA) for managing customer records and turning them into live workspace metrics. It uses the HTML5 History API for client-side routing, CSS custom properties for theming, localStorage for browser persistence, CSV import/export, and DOM-safe rendering with no application-level `innerHTML`.

## Features

- Custom SPA routes: `/dashboard`, `/analytics`, `/customers`, `/settings`
- History API navigation with `pushState()` and `popstate`
- Dark / Light / System theme preference
- Persistent localStorage data and settings
- Customer create, edit, delete, search, and status filtering
- CSV import with validation
- CSV export for backups
- Dashboard KPIs calculated from current records
- Analytics derived from the same customer data
- Responsive layout
- `DocumentFragment` and `requestAnimationFrame()` rendering
- DOM-safe `createElement()` / `textContent` rendering
- Zero-dependency local SPA server for route refresh support
- Vercel and Netlify SPA fallback configuration

## Project Structure

```text
pulseboard-saas-analytics/
├── index.html
├── styles.css
├── app.js
├── server.cjs
├── vercel.json
├── netlify.toml
├── _redirects
├── .gitignore
├── LICENSE
└── README.md
```

## Run in VS Code — Recommended

Live Server cannot serve clean History API routes such as `/settings` after a hard refresh. This project therefore includes two working local modes:

- **Live Server on port 5501:** automatically uses a hash fallback (`/#/settings`) so refreshes work.
- **Included Node server:** uses clean History API URLs (`/settings`) with an SPA fallback.

For the cleanest local URLs, run from the project root:

```bash
node server.cjs
```

Open:

```text
http://127.0.0.1:5500/dashboard
```

You can then navigate to:

```text
/dashboard
/analytics
/customers
/settings
```

Refresh any of those URLs. The server returns `index.html`, so the SPA router can load the correct view.

You can choose another port:

```powershell
$env:PORT=5600
node server.cjs
```

## Why Live Server Shows `Cannot GET /settings`

The History API changes the URL without reloading the document. On a hard refresh, the web server must still return `index.html` for `/settings`. Live Server does not provide that SPA fallback, while the included `server.cjs`, Vercel rewrite, and Netlify redirect do.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Use the project root as the deployment root.
4. No build command is required.
5. Deploy.

The included `vercel.json` routes application URLs back to `index.html` while preserving normal static assets.

## Deploy to Netlify

1. Push the repository to GitHub.
2. Import the repository into Netlify.
3. No build command is required.
4. Publish directory: `.`
5. Deploy.

The included `netlify.toml` and `_redirects` provide SPA fallback behavior.

## Data Model

Customer records use these fields:

```text
name,email,plan,mrr,status,joined
```

Example CSV:

```csv
name,email,plan,mrr,status,joined
Aarav Mehta,aarav@example.com,Growth,12900,Active,2026-08-24
Maya Singh,maya@example.com,Scale,32900,Active,2026-08-12
Karan Rao,karan@example.com,Starter,4900,Trial,2026-09-01
```

## Important Storage Note

This version is a real client-side application, but it is intentionally browser-local. Customer data and preferences are stored in `localStorage` and are not synchronized between devices or users.

For a full multi-user SaaS product, the next layer would be authentication, a server/API, authorization, and a cloud database.

## GitHub

```bash
git init
git add .
git commit -m "Build PulseBoard SaaS analytics dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pulseboard-saas-analytics.git
git push -u origin main
```

## License

MIT License. See `LICENSE`.
