import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <a className="brand" href="/">KIOREL</a>
        <form action="/auth/signout" method="post"><button className="button secondary">Sign out</button></form>
      </header>
      <section className="dashboard-card">
        <span className="mono auth-label">KIOREL CONTROL PLANE</span>
        <h1>Welcome to KIOREL.</h1>
        <p className="lead">Authentication is working. Your workspace is ready for the website onboarding step.</p>
        <div className="status-row">
          <span>Signed in as</span><strong>{user.email}</strong>
        </div>
        <div className="status-row">
          <span>Organization</span><strong>{profile?.organization_id ? "Configured" : "Not configured yet"}</strong>
        </div>
        <div className="dashboard-grid">
          <article className="card"><span className="card-index">01 / WEBSITE</span><h2>Add your website</h2><p>Register a site and generate its KIOREL ingestion credential.</p></article>
          <article className="card"><span className="card-index">02 / EVENTS</span><h2>Event pipeline</h2><p>Send normalized events into KIOREL before routing them to destinations.</p></article>
          <article className="card"><span className="card-index">03 / TEST</span><h2>BirdsAviary test</h2><p>Use the first real site to validate tracking accuracy before customer rollout.</p></article>
        </div>
      </section>
    </main>
  );
}
