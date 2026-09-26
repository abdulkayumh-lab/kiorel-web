import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/tiff"]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds the 20 MB limit." }, { status: 413 });
  }

  const { data: organizationId, error: workspaceError } = await supabase.rpc("ensure_workspace", {
    workspace_name: "KIOREL Workspace",
  });
  if (workspaceError || !organizationId) {
    return NextResponse.json({ error: "Could not initialize workspace." }, { status: 500 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const mediaId = randomUUID();
  const storageKey = `org/${organizationId}/media/${mediaId}/original`;

  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage.from("kiorel-media").upload(storageKey, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Could not store media. Create the kiorel-media storage bucket first." }, { status: 500 });
  }

  const { data: media, error: mediaError } = await admin.from("media").insert({
    id: mediaId,
    organization_id: organizationId,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sha256,
    storage_key: storageKey,
  }).select("id,filename,mime_type,size_bytes,sha256,storage_key").single();

  if (mediaError || !media) {
    await admin.storage.from("kiorel-media").remove([storageKey]);
    return NextResponse.json({ error: "Could not create media record." }, { status: 500 });
  }

  const { data: analysis, error: analysisError } = await admin.from("analyses").insert({
    media_id: media.id,
    status: "queued",
    pipeline_version: "1.0.0",
  }).select("id,status").single();

  if (analysisError || !analysis) {
    await admin.from("media").delete().eq("id", media.id);
    await admin.storage.from("kiorel-media").remove([storageKey]);
    return NextResponse.json({ error: "Could not create analysis." }, { status: 500 });
  }

  await admin.from("analysis_jobs").insert([
    { analysis_id: analysis.id, job_type: "ingest" },
    { analysis_id: analysis.id, job_type: "provenance" },
    { analysis_id: analysis.id, job_type: "pixel_analysis" },
    { analysis_id: analysis.id, job_type: "ml_analysis" },
    { analysis_id: analysis.id, job_type: "evidence_fusion" },
    { analysis_id: analysis.id, job_type: "reporting" },
  ]);

  await admin.from("audit_events").insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    action: "forensics.analysis.created",
    resource_type: "analysis",
    resource_id: analysis.id,
    details: { media_id: media.id, sha256 },
  });

  return NextResponse.json({
    media_id: media.id,
    analysis_id: analysis.id,
    status: analysis.status,
  }, { status: 202 });
}
