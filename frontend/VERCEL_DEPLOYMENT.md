# VINATEX IT Helpdesk — Vercel deployment

## Vercel project

Create a Vercel project from this repository and set:

- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

## Environment variable

Set this in Vercel for Preview and Production:

```env
VITE_API_URL=https://<your-backend-domain>/api/v1
```

Do not commit production secrets or JWT credentials to Git.

## Backend

The current backend is a long-running Express/Socket.IO application with cron jobs and should remain on a persistent Node.js host (for example Render) rather than being deployed as a Vercel serverless function.

The frontend only needs the public HTTPS API base URL above.

## SPA routing

`vercel.json` provides the Vite build/output configuration and SPA fallback so React Router routes such as `/tickets` continue to work after a direct page refresh.
