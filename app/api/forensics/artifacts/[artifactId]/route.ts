import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artifactId } = await params;
  const { data: organizationId, error: workspaceError } = await supabase.rpc("ensure_workspace", {
    workspace_name: "KIOREL Workspace",
  });
  if (workspaceError || !organizationId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 403 });
  }

  const { data: artifact } = await supabase
    .from("forensic_artifacts")
    .select("id,storage_key,analysis_id,analyses!inner(media!inner(organization_id))")
    .eq("id", artifactId)
    .maybeSingle();

  if (!artifact || (artifact.analyses as any)?.media?.organization_id !== organizationId) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("kiorel-media")
    .createSignedUrl(artifact.storage_key, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Artifact unavailable" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
