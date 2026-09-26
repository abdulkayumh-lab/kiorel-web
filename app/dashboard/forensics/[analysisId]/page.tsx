import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ForensicAnalysisPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { analysisId } = await params;
  const { data: analysis } = await supabase.from("analyses").select("*,media(*)").eq("id", analysisId).maybeSingle();
  if (!analysis) notFound();

  const [{ data: evidence }, { data: provenance }, { data: artifacts }, { data: detectorRuns }, { data: fusionRuns }] = await Promise.all([
    supabase.from("evidence_items").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("provenance_records").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("forensic_artifacts").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("detector_runs").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.from("fusion_runs").select("*").eq("analysis_id", analysisId).order("created_at", { ascending: false }),
  ]);

  const classification = fusionRuns?.[0]?.classification ?? analysis.assessment ?? "ANALYSIS IN PROGRESS";
  const isUndetermined = classification === "AUTHENTICITY_UNDETERMINED";
  const displayStatus = analysis.status.replaceAll("_", " ");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-nav">
        <Link className="brand" href="/dashboard">KIOREL</Link>
        <div className="dashboard-actions">
          <Link className="button secondary" href="/dashboard/forensics">All investigations</Link>
          <Link className="button primary" href="/dashboard/forensics/upload">New analysis</Link>
        </div>
      </header>

      <section className="dashboard-card">
        <div className="analysis-hero">
          <div>
            <span className="mono dashboard-eyebrow">FORENSIC ANALYSIS / {analysis.pipeline_version}</span>
            <h1>{analysis.media?.filename ?? "Media investigation"}</h1>
            <p className="analysis-assessment">{analysis.assessment ?? "Analysis is " + displayStatus.toLowerCase() + "."}</p>
          </div>
          <div className="analysis-badge">{classification}</div>
        </div>

        <div className="analysis-meta">
          <div className="status-row"><span>Status</span><strong>{displayStatus}</strong></div>
          <div className="status-row"><span>Assessment confidence</span><strong>{analysis.confidence !== null ? Math.round(Number(analysis.confidence) * 100) + "%" : "Not available"}</strong></div>
        </div>

        <div className="forensic-section-grid">
          <article className="forensic-panel">
            <span className="card-index">01 / PROVENANCE</span><h2>Provenance</h2>
            {provenance?.length ? provenance.map((item: any) => (
              <div className="forensic-item" key={item.id}><strong>{item.source}</strong> · {item.status}
                {item.source === "c2pa" && item.status === "manifest_found" && <p className="forensic-note">C2PA manifest detected and parsed.</p>}
              </div>
            )) : <p className="forensic-note">No provenance results yet.</p>}
          </article>

          <article className="forensic-panel">
            <span className="card-index">02 / SIGNAL FORENSICS</span><h2>Diagnostic signals</h2>
            {detectorRuns?.length ? detectorRuns.map((run: any) => (
              <div className="forensic-item" key={run.id}><strong>{run.detector_name}</strong>{run.score !== null ? " · " + Number(run.score).toPrecision(5) : ""}</div>
            )) : <p className="forensic-note">Signal detectors will appear as workers complete.</p>}
            <p className="forensic-note" style={{marginTop:16}}>Diagnostic scores are forensic measurements, not manipulation probabilities.</p>
          </article>

          <article className="forensic-panel">
            <span className="card-index">03 / EVIDENCE</span><h2>Evidence ledger</h2>
            {evidence?.length ? evidence.map((item: any) => (
              <div className="forensic-item" key={item.id}><strong>{item.detector}</strong> · {item.finding}</div>
            )) : <p className="forensic-note">Evidence will appear as workers complete.</p>}
          </article>

          <article className="forensic-panel">
            <span className="card-index">04 / EVIDENCE FUSION</span><h2>Assessment</h2>
            {fusionRuns?.[0] ? (
              <>
                <div className="forensic-item"><strong>{fusionRuns[0].classification}</strong></div>
                {fusionRuns[0].confidence !== null && <div className="forensic-item">Confidence · {Math.round(Number(fusionRuns[0].confidence) * 100)}%</div>}
                <p className="forensic-note">{fusionRuns[0].limitations?.length ? fusionRuns[0].limitations.join(" ") : "Evidence was evaluated using the current fusion policy."}</p>
              </>
            ) : <p className="forensic-note">Fusion will appear after evidence stages complete.</p>}
          </article>

          <article className="forensic-panel">
            <span className="card-index">05 / ARTIFACTS</span><h2>Forensic maps</h2>
            {artifacts?.length ? (
              <div className="artifact-list">{artifacts.map((item: any) => (
                <Link className="artifact-link" href={"/api/forensics/artifacts/" + item.id} target="_blank" key={item.id}>
                  <span>{item.artifact_type}</span><span>Open ↗</span>
                </Link>
              ))}</div>
            ) : <p className="forensic-note">No forensic artifacts yet.</p>}
          </article>

          <article className="forensic-panel">
            <span className="card-index">06 / FILE IDENTITY</span><h2>Media fingerprint</h2>
            <div className="forensic-item"><strong>SHA-256</strong><p className="forensic-note" style={{wordBreak:"break-all"}}>{analysis.media?.sha256}</p></div>
            <div className="forensic-item"><strong>Pipeline</strong> · {analysis.pipeline_version}</div>
          </article>
        </div>

        {isUndetermined && <div className="dashboard-footer-line">No verified C2PA provenance support or approved manipulation-probability detector output was available for this assessment.</div>}
      </section>
    </main>
  );
}