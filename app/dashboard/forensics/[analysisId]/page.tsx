import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ForensicAnalysisPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { analysisId } = await params;
  const { data: analysis } = await supabase
    .from("analyses")
    .select("*,media(*)")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) notFound();

  const [{ data: evidence }, { data: provenance }, { data: artifacts }, { data: detectorRuns }, { data: fusionRuns }] = await Promise.all([
    supabase.from("evidence_items").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("provenance_records").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("forensic_artifacts").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("detector_runs").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("fusion_runs").select("*").eq("analysis_id", analysisId).order("created_at", { ascending: false }),
  ]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <Link className="button secondary" href="/dashboard/forensics">All investigations</Link>
      </header>
      <section className="dashboard-card">
        <span className="mono auth-label">FORENSIC ANALYSIS</span>
        <h1>{analysis.media?.filename ?? "Media investigation"}</h1>
        <p className="lead">{analysis.assessment ?? "Analysis is " + analysis.status.replaceAll("_", " ").toLowerCase() + "."}</p>

        <div className="status-row">
          <span>Status</span><strong>{analysis.status}</strong>
        </div>
        {analysis.confidence !== null && (
          <div className="status-row">
            <span>Assessment confidence</span><strong>{Math.round(Number(analysis.confidence) * 100)}%</strong>
          </div>
        )}

        <div className="dashboard-grid">
          <article className="card">
            <span className="card-index">01 / PROVENANCE</span>
            <h2>Provenance</h2>
            {provenance?.length ? provenance.map((item) => (
              <div key={item.id}>
                <p><strong>{item.source}</strong>: {item.status}</p>
                {item.source === "c2pa" && item.status === "manifest_found" && (
                  <p className="mono">C2PA manifest detected and parsed.</p>
                )}
              </div>
            )) : <p>No provenance results yet.</p>}
          </article>

          <article className="card">
            <span className="card-index">02 / SIGNAL FORENSICS</span>
            <h2>Detector runs</h2>
            {detectorRuns?.length ? detectorRuns.map((run) => (
              <div key={run.id}>
                <p><strong>{run.detector_name}</strong>{run.score !== null ? " · score " + Number(run.score).toPrecision(5) : ""}</p>
              </div>
            )) : <p>Signal detectors will appear as workers complete.</p>}
          </article>

          <article className="card">
            <span className="card-index">03 / EVIDENCE</span>
            <h2>Evidence</h2>
            {evidence?.length ? evidence.map((item) => (
              <p key={item.id}><strong>{item.detector}</strong>: {item.finding}</p>
            )) : <p>Evidence will appear as workers complete.</p>}
          </article>

          <article className="card">
            <span className="card-index">04 / EVIDENCE FUSION</span>
            <h2>Fusion result</h2>
            {fusionRuns?.[0] ? (
              <>
                <p><strong>{fusionRuns[0].classification}</strong></p>
                {fusionRuns[0].confidence !== null && <p>Confidence: {Math.round(Number(fusionRuns[0].confidence) * 100)}%</p>}
                <p className="mono">Snapshot: {fusionRuns[0].evidence_snapshot_hash}</p>
                {fusionRuns[0].limitations?.length ? <p>{fusionRuns[0].limitations.join(" ")}</p> : null}
              </>
            ) : <p>Fusion will appear after all evidence stages complete.</p>}
          </article>

          <article className="card">
            <span className="card-index">05 / ARTIFACTS</span>
            <h2>Forensic maps</h2>
            {artifacts?.length ? artifacts.map((item) => (
              <p key={item.id}>
                <Link href={"/api/forensics/artifacts/" + item.id} target="_blank">
                  {item.artifact_type} heatmap
                </Link>
              </p>
            )) : <p>No forensic artifacts yet.</p>}
          </article>
        </div>

        <div className="status-row">
          <span>SHA-256</span>
          <strong className="mono">{analysis.media?.sha256}</strong>
        </div>
        <div className="status-row">
          <span>Pipeline</span><strong>{analysis.pipeline_version}</strong>
        </div>
      </section>
    </main>
  );
}
