import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: analysis, error } = await supabase
    .from("analyses")
    .select("id,status,assessment,confidence,pipeline_version,started_at,completed_at,error_code,error_message,created_at,media(id,filename,mime_type,size_bytes,sha256,width,height)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not load analysis." }, { status: 500 });
  if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  const { data: jobs } = await supabase
    .from("analysis_jobs")
    .select("id,job_type,status,attempts,progress,error_message,started_at,completed_at")
    .eq("analysis_id", id)
    .order("created_at");

  return NextResponse.json({ analysis, jobs: jobs ?? [] });
}
