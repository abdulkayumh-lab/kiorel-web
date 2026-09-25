import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const websiteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  domain: z.string().trim().min(1).max(255),
});

function normalizeDomain(domain: string) {
  return domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\/$/, "");
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = websiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid website details." }, { status: 400 });
  }

  const domain = normalizeDomain(parsed.data.domain);
  const { data: organizationId, error: workspaceError } = await supabase.rpc("ensure_workspace", {
    workspace_name: "KIOREL Workspace",
  });

  if (workspaceError || !organizationId) {
    return NextResponse.json({ error: "Could not initialize workspace." }, { status: 500 });
  }

  const rawKey = "krl_live_" + randomBytes(24).toString("base64url");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16);

  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .insert({ organization_id: organizationId, name: parsed.data.name, domain })
    .select("id,name,domain,status,created_at")
    .single();

  if (websiteError || !website) {
    if (websiteError?.code === "23505") return NextResponse.json({ error: "This domain is already registered in your workspace." }, { status: 409 });
    return NextResponse.json({ error: "Could not create website." }, { status: 500 });
  }

  const { error: keyError } = await supabase.from("api_keys").insert({
    website_id: website.id,
    name: "Default browser ingestion key",
    key_prefix: keyPrefix,
    key_hash: keyHash,
  });

  if (keyError) {
    await supabase.from("websites").delete().eq("id", website.id);
    return NextResponse.json({ error: "Could not create ingestion key." }, { status: 500 });
  }

  return NextResponse.json({ website, api_key: rawKey }, { status: 201 });
}
