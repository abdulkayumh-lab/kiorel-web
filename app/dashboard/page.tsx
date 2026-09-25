import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: organizationId } = await supabase.rpc("ensure_workspace", {
    workspace_name: "KIOREL Workspace",
  });

  const { data: websites } = organizationId
    ? await supabase
        .from("websites")
        .select("id,name,domain,status,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <a className="brand" href="/">KIOREL</a>
        <div className="dashboard-actions">
          <span className="user-email">{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="button secondary">Sign out</button>
          </form>
        </div>
      </header>

      <section className="dashboard-card">
        <span className="mono auth-label">KIOREL CONTROL PLANE</span>
        <h1>Welcome to KIOREL.</h1>
        <p className="lead">
          Manage your websites, event collection, and tracking tests from one control plane.
        </p>

        <div className="status-row">
          <span>Signed in as</span>
          <strong>{user.email}</strong>
        </div>
        <div className="status-row">
          <span>Organization</span>
          <strong>{organizationId ? "Configured" : "Not configured yet"}</strong>
        </div>

        <div className="dashboard-section-head">
          <div>
            <span className="mono">WEBSITES</span>
            <h2>Your connected sites</h2>
          </div>
          <Link className="button primary" href="/dashboard/websites/new">
            Add website
          </Link>
        </div>

        {websites && websites.length > 0 ? (
          <div className="website-list">
            {websites.map((website) => (
              <div className="website-row" key={website.id}>
                <div>
                  <strong>{website.name}</strong>
                  <span>{website.domain}</span>
                </div>
                <span className="status-badge">{website.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No websites connected yet.</strong>
            <p>Add a website to generate its KIOREL ingestion credential.</p>
          </div>
        )}

        <div className="dashboard-section-head">
          <div>
            <span className="mono">NEXT STEPS</span>
            <h2>Event pipeline</h2>
          </div>
        </div>

        <div className="dashboard-grid">
          <article className="card">
            <span className="card-index">01 / WEBSITE</span>
            <h2>Website onboarding</h2>
            <p>Register sites and manage their connection status.</p>
          </article>
          <article className="card">
            <span className="card-index">02 / EVENTS</span>
            <h2>Event pipeline</h2>
            <p>Send normalized events into KIOREL before routing them to destinations.</p>
          </article>
          <article className="card">
            <span className="card-index">03 / TEST</span>
            <h2>Test ingestion</h2>
            <p>Validate the event API with the KIOREL test site before connecting BirdsAviary.net.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
