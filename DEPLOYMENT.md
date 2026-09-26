# KIOREL deployment

## Free control plane

- Vercel: Next.js dashboard
- Supabase: Postgres, Auth, and private media storage
- Cloudflare: DNS
- GitHub Actions: web build validation

## Required Vercel environment variables

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Keep SUPABASE_SERVICE_ROLE_KEY server-side only.

## Forensics worker

The web control plane can be deployed without a GPU. Neural inference remains disabled until FORENSICS_ML_URL points to a running inference service and approved calibration records are available.

## First deployment checks

1. Apply all Supabase migrations.
2. Deploy the Next.js project.
3. Authenticate at /login.
4. Open /dashboard/forensics.
5. Upload a supported image under 20 MB.
6. Confirm a queued analysis and analysis jobs are created.
7. Start the forensics worker when you are ready to process the queue.

Vercel Hobby is $0 but is restricted to personal/non-commercial use by its terms. For commercial production, use a plan whose terms permit the intended use.
