# KIOREL

KIOREL is a first-party marketing data infrastructure platform for collecting, validating, deduplicating, routing, and debugging conversion events.

## Platform

- **Signal** — first-party event collection
- **Flow** — event routing and delivery
- **Trace** — attribution and event debugging
- **Pulse** — tracking health and monitoring
- **Guard** — consent and data governance
- **AI** — diagnostics and remediation guidance

## Current foundation

The repository is migrating from the original static concept site into the KIOREL platform.

Stack:
- Next.js + TypeScript
- Supabase PostgreSQL + Auth
- Zod event validation
- API foundation for event ingestion
- Supabase migrations for the initial data model

Event flow:

Website / WordPress → KIOREL Gateway → validate / consent / deduplicate → queue + retry → Meta CAPI / GA4 / other destinations.

## Local environment

Set:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Never commit real credentials or service-role keys.

## Structure

```
app/
app/api/
lib/
supabase/migrations/
```
