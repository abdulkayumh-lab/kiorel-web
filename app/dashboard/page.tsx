import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: organizationId } = await supabase.rpc("ensure_workspace", { workspace_name: "KIOREL Workspace" });
  const { data: websites } = organizationId ? await supabase.from("websites").select("id,name,domain,status,created_at").eq("organization_id", organizationId).order("created_at",{ascending:false}) : {data:[]};
  const { count: forensicCount } = organizationId ? await supabase.from("media").select("id",{count:"exact",head:true}).eq("organization_id",organizationId) : {count:0};
  const { count: processingCount } = organizationId ? await supabase.from("analyses").select("id,media!inner(organization_id)",{count:"exact",head:true}).eq("media.organization_id",organizationId).in("status",["queued","ingesting","provenance","pixel_analysis","ml_analysis","evidence_fusion","reporting"]) : {count:0};

  return <main className="dashboard-shell analyst-console">
    <header className="dashboard-nav"><Link className="brand" href="/dashboard">KIOREL</Link><div className="dashboard-actions"><span className="user-email">{user.email}</span><form action="/auth/signout" method="post"><button className="button secondary">Sign out</button></form></div></header>
    <section className="dashboard-card">
      <div className="analyst-topbar">
        <div className="analyst-title"><span className="mono">CONTROL PLANE</span><h1>Analyst Console</h1><span className="console-status">Operational</span></div>
        <div className="console-actions"><Link className="button secondary" href="/dashboard/websites/new">Add site</Link><Link className="button primary" href="/dashboard/forensics/upload">New analysis</Link></div>
      </div>
      <nav className="console-nav"><Link href="/dashboard">Overview</Link><Link href="/dashboard/forensics">Forensics</Link><Link href="/dashboard/websites/new">Websites</Link></nav>

      <div className="console-grid">
        <div className="console-main">
          <div className="console-metrics">
            <div className="console-metric"><span>Media</span><strong>{forensicCount ?? 0}</strong><small>records</small></div>
            <div className="console-metric"><span>Processing</span><strong>{processingCount ?? 0}</strong><small>active jobs</small></div>
            <div className="console-metric"><span>Workspace</span><strong>{organizationId ? "READY" : "SETUP"}</strong><small>configuration</small></div>
            <div className="console-metric"><span>Pipeline</span><strong>1.1.0</strong><small>forensics</small></div>
          </div>
          <div className="console-panel-head"><h2>Media intelligence</h2><Link className="mono" href="/dashboard/forensics">View all →</Link></div>
          <div style={{padding:"12px"}}><Link className="card" style={{display:"block",minHeight:"auto",padding:"18px"}} href="/dashboard/forensics"><span className="card-index">FORENSIC ENGINE</span><h2 style={{margin:"12px 0 5px",fontSize:"17px"}}>Evidence-first media analysis</h2><p>Provenance · pixel signals · neural detection · evidence fusion · reporting</p></Link></div>
        </div>

        <aside className="console-side">
          <div className="console-side-section"><h3>System</h3><div className="console-kv"><span>Workspace</span><strong>{organizationId ? "Configured" : "Setup"}</strong></div><div className="console-kv"><span>Worker</span><span className="console-status">Active</span></div><div className="console-kv"><span>Pipeline</span><strong>1.1.0</strong></div></div>
          <div className="console-side-section"><h3>Connected sites</h3>{websites?.length ? websites.slice(0,5).map((w:any)=><div className="console-kv" key={w.id}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"170px"}}>{w.domain}</span><span className="console-status">{w.status}</span></div>) : <span className="console-sub">No sites connected.</span>}</div>
          <div className="console-side-section"><h3>Operator</h3><div className="console-kv"><span>Account</span><strong style={{maxWidth:"170px",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</strong></div></div>
        </aside>
      </div>
    </section>
  </main>;
}