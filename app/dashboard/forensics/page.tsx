import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ForensicsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: organizationId } = await supabase.rpc("ensure_workspace", { workspace_name: "KIOREL Workspace" });
  const { data: analyses } = organizationId
    ? await supabase.from("analyses").select("id,status,assessment,confidence,created_at,media(filename,mime_type)")
        .order("created_at", { ascending: false }).limit(25)
    : { data: [] };

  const rows = analyses ?? [];
  const completed = rows.filter((a: any) => a.status === "complete").length;
  const active = rows.filter((a: any) => a.status !== "complete" && a.status !== "failed").length;
  const failed = rows.filter((a: any) => a.status === "failed").length;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <Link className="button secondary" href="/dashboard">Control plane</Link>
      </header>
      <section className="dashboard-card">
        <div className="dashboard-hero">
          <div>
            <span className="mono dashboard-eyebrow">MEDIA INTELLIGENCE / FORENSICS</span>
            <h1>Investigations</h1>
            <p className="lead">Review media provenance, forensic signals, detector evidence, and evidence-fusion assessments.</p>
          </div>
          <div className="dashboard-hero-actions"><Link className="button primary" href="/dashboard/forensics/upload">Analyze media</Link></div>
        </div>

        <div className="forensics-summary">
          <div className="forensics-summary-item"><span>Total shown</span><strong>{rows.length}</strong></div>
          <div className="forensics-summary-item"><span>Completed</span><strong>{completed}</strong></div>
          <div className="forensics-summary-item"><span>Processing</span><strong>{active}</strong></div>
          <div className="forensics-summary-item"><span>Failed</span><strong>{failed}</strong></div>
        </div>

        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <div><span className="mono">RECENT ANALYSES</span><h2>Investigation queue</h2></div>
          </div>
          {rows.length ? (
            <div className="dashboard-list">
              {rows.map((analysis: any) => (
                <Link className="dashboard-list-row" href={"/dashboard/forensics/" + analysis.id} key={analysis.id}>
                  <div>
                    <strong>{analysis.media?.filename ?? "Untitled media"}</strong>
                    <span className="secondary-text">{analysis.assessment ?? "Analysis " + analysis.status.replaceAll("_", " ")}</span>
                  </div>
                  <span className="row-meta">{new Date(analysis.created_at).toLocaleString()}</span>
                  <span className="dashboard-status">{analysis.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state"><strong>No forensic analyses yet.</strong><p>Upload an image to create the first investigation.</p></div>
          )}
        </section>
      </section>
    </main>
  );
}