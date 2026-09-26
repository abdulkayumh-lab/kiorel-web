import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: organizationId } = await supabase.rpc("ensure_workspace", { workspace_name: "KIOREL Workspace" });

  const { data: websites } = organizationId
    ? await supabase.from("websites").select("id,name,domain,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false })
    : { data: [] };

  const { count: forensicCount } = organizationId
    ? await supabase.from("media").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)
    : { count: 0 };

  const { count: processingCount } = organizationId
    ? await supabase.from("analyses").select("id,media!inner(organization_id)", { count: "exact", head: true })
        .eq("media.organization_id", organizationId)
        .in("status", ["queued","ingesting","provenance","pixel_analysis","ml_analysis","evidence_fusion","reporting"])
    : { count: 0 };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <div className="dashboard-actions">
          <span className="user-email">{user.email}</span>
          <form action="/auth/signout" method="post"><button className="button secondary">Sign out</button></form>
        </div>
      </header>

      <section className="dashboard-card">
        <div className="dashboard-hero">
          <div>
            <span className="mono dashboard-eyebrow">CONTROL PLANE / OVERVIEW</span>
            <h1>Workspace overview</h1>
            <p className="lead">Monitor your KIOREL workspace, media investigations, and connected data infrastructure.</p>
          </div>
          <div className="dashboard-hero-actions">
            <Link className="button secondary" href="/dashboard/websites/new">Add website</Link>
            <Link className="button primary" href="/dashboard/forensics/upload">Analyze media</Link>
          </div>
        </div>

        <section className="dashboard-section">
          <div className="dashboard-metrics">
            <div className="dashboard-metric"><span className="metric-label">Media records</span><div className="metric-value">{forensicCount ?? 0}</div><p>Total uploaded media</p></div>
            <div className="dashboard-metric"><span className="metric-label">Processing</span><div className="metric-value">{processingCount ?? 0}</div><p>Active forensic analyses</p></div>
            <div className="dashboard-metric"><span className="metric-label">Workspace</span><div className="metric-value">{organizationId ? "Ready" : "Setup"}</div><p>{organizationId ? "Organization configured" : "Organization not configured"}</p></div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <div><span className="mono">MEDIA INTELLIGENCE</span><h2>Forensic analysis</h2></div>
            <Link className="button secondary" href="/dashboard/forensics">Open investigations</Link>
          </div>
          <div className="dashboard-grid">
            <Link className="card" href="/dashboard/forensics">
              <span className="card-index">01 / INVESTIGATIONS</span>
              <h2>Review media</h2>
              <p>Inspect provenance, pixel-forensic signals, detector evidence, artifacts, and final assessments.</p>
            </Link>
            <article className="card">
              <span className="card-index">02 / PIPELINE</span>
              <h2>Evidence-first processing</h2>
              <p>Analyses move through ingest, provenance, pixel analysis, ML, evidence fusion, and reporting.</p>
            </article>
            <article className="card">
              <span className="card-index">03 / PROVENANCE</span>
              <h2>Traceable findings</h2>
              <p>Keep provenance, diagnostic signals, detector outputs, and conclusions distinct.</p>
            </article>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <div><span className="mono">WEBSITES</span><h2>Connected sites</h2></div>
            <Link className="button secondary" href="/dashboard/websites/new">Add website</Link>
          </div>
          {websites && websites.length > 0 ? (
            <div className="dashboard-list">
              {websites.map((website) => (
                <div className="dashboard-list-row" key={website.id}>
                  <div><strong>{website.name}</strong><span className="secondary-text">{website.domain}</span></div>
                  <span className="row-meta">{website.status}</span>
                  <span className="dashboard-status">{website.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><strong>No websites connected yet.</strong><p>Add a website to generate its KIOREL ingestion credential.</p></div>
          )}
        </section>

        <div className="dashboard-footer-line">Signed in as {user.email} · KIOREL Workspace</div>
      </section>
    </main>
  );
}