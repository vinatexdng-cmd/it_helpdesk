# VINATEX IT Helpdesk — Production environment checklist

This project uses:
- Vercel for the React/Vite frontend.
- Render Web Service for the persistent Express + Socket.IO backend.
- PostgreSQL for Prisma.
- Redis for backend caching/session-related features.
- Render Persistent Disk for uploaded attachments.

## 1. Supabase PostgreSQL

Create a Supabase project and open Connect.

For the Render persistent backend, use the Session pooler connection string when the Render service needs an IPv4-reachable endpoint. Copy the exact connection string shown by Supabase; do not construct the pooler hostname manually.

Set in Render:

DATABASE_URL=<Supabase PostgreSQL connection string>?schema=public

If the copied URL already contains query parameters, append &schema=public instead.

Do not put the database password in Git.

After the first deployment, Render runs:

npx prisma migrate deploy

The repository already contains Prisma migrations under backend/prisma/migrations.

## 2. Upstash Redis

Create an Upstash Redis database in a region close to the backend.

This backend uses ioredis, so use the TCP/TLS connection string from the Upstash Console, normally in the form:

rediss://default:<PASSWORD>@<ENDPOINT>:<PORT>

Set in Render:

REDIS_URL=<Upstash TCP/TLS connection string>

Do not use UPSTASH_REDIS_REST_URL for this backend unless the code is changed from ioredis to the Upstash HTTP client.

## 3. Render backend variables

Required values:

- NODE_ENV=production
- PORT=10000
- UPLOAD_DIR=/var/data/uploads
- DATABASE_URL=<secret>
- REDIS_URL=<secret>
- JWT_SECRET=<Render generated value>
- REFRESH_JWT_SECRET=<Render generated value>
- REVIEW_JWT_SECRET=<Render generated value>
- PUBLIC_API_URL=https://<render-service-domain>
- CORS_ORIGINS=https://<vercel-frontend-domain>
- GOOGLE_CLIENT_ID=<Google OAuth client ID>
- COMPANY_EMAIL_DOMAIN=<allowed email domains>
- SMTP_HOST=<mail server>
- SMTP_PORT=587
- SMTP_SECURE=false
- SMTP_USER=<mail account>
- SMTP_PASS=<mail app password/token>

For multiple frontend domains, separate CORS_ORIGINS values with commas.

## 4. Vercel frontend

Vercel project settings:

- Root Directory: frontend
- Framework: Vite
- Build Command: npm run build
- Output Directory: dist

Set:

VITE_API_URL=https://<render-service-domain>/api/v1

Set the variable for both Preview and Production as appropriate.

## 5. First production test

After Render reports the service as live:

1. Open https://<render-service-domain>/health.
2. Open the Swagger endpoint exposed by the backend.
3. Open the Vercel frontend.
4. Test login.
5. Test ticket creation.
6. Test ticket comments/realtime Socket.IO.
7. Upload a JPG/PDF/DOCX/XLSX file.
8. Verify the uploaded file is available after a service restart.
9. Test Redis-dependent features.
10. Test email notifications.

## Important storage note

The Render service has a persistent disk mounted at /var/data. The application writes attachments under /var/data/uploads.

Render persistent disks preserve filesystem changes under the mount path across deploys/restarts, but a disk is attached to a single service instance. If the application later needs horizontal scaling, move attachments to object storage (S3-compatible storage or Supabase Storage) instead of relying on the local disk.
