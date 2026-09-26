import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ForensicsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: organizationId } = await supabase.rpc("ensure_workspace", {
    workspace_name: "KIOREL Workspace",
  });

  const { data: analyses } = organizationId
    ? await supabase
        .from("analyses")
        .select("id,status,assessment,confidence,created_at,media(filename,mime_type)")
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <Link className="button secondary" href="/dashboard">Control plane</Link>
      </header>
      <section className="dashboard-card">
        <span className="mono auth-label">MEDIA FORENSICS</span>
        <div className="dashboard-section-head">
          <div>
            <h1>Forensic investigations</h1>
            <p className="lead">Review provenance, manipulation indicators, and synthetic-media evidence.</p>
          </div>
          <Link className="button primary" href="/dashboard/forensics/upload">Analyze media</Link>
        </div>

        <div className="website-list">
          {(analyses ?? []).map((analysis: any) => (
            <Link className="website-row" href={"/dashboard/forensics/" + analysis.id} key={analysis.id}>
              <div>
                <strong>{analysis.media?.filename ?? "Untitled media"}</strong>
                <span>{analysis.assessment ?? "Analysis queued"} · {new Date(analysis.created_at).toLocaleString()}</span>
              </div>
              <span className="status-badge">{analysis.status}</span>
            </Link>
          ))}
          {(!analyses || analyses.length === 0) && (
            <div className="empty-state">
              <strong>No forensic analyses yet.</strong>
              <p>Upload an image to create the first investigation.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
