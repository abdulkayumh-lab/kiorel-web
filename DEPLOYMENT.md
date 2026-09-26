# KIOREL deployment

## Free control plane

- Vercel: Next.js dashboard
- Supabase: Postgres, Auth, and private media storage
- Cloudflare: DNS
- GitHub Actions: web build validation and scheduled CPU forensic processing

## Required Vercel environment variables

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Keep SUPABASE_SERVICE_ROLE_KEY server-side only.

## CPU forensics worker

The forensic worker is a separate Python process. It must not run inside the Next.js/Vercel request process.

The repository provides two deployment paths:

1. GitHub Actions scheduled worker (default $0 path) — .github/workflows/forensics-worker.yml runs every five minutes and drains eligible queued jobs for a bounded execution window.
2. Container worker — services/forensics/worker.Dockerfile builds a standalone worker image for a long-running container host.

The GitHub Actions worker requires repository secrets KIOREL_SUPABASE_URL and KIOREL_SUPABASE_SERVICE_ROLE_KEY. The service-role key must never be exposed to the browser or committed to the repository.

The worker processes stages in order: ingest → provenance → pixel_analysis → ml_analysis → evidence_fusion → reporting. The database claim function only releases the stage matching the current analysis status.

## First deployment checks

1. Apply all Supabase migrations.
2. Deploy the Next.js project.
3. Authenticate at /login.
4. Open /dashboard/forensics.
5. Upload a supported image under 20 MB.
6. Confirm a queued analysis and analysis jobs are created.
7. Start the forensics worker when you are ready to process the queue.

Vercel Hobby is $0 but is restricted to personal/non-commercial use by its terms. For commercial production, use a plan whose terms permit the intended use.
