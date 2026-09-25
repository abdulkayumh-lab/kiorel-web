import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const eventSchema = z.object({
  event_name: z.string().min(1).max(100),
  event_id: z.string().min(1).max(200),
  event_time: z.string().datetime().optional(),
  website_id: z.string().uuid(),
  properties: z.record(z.string(), z.unknown()).default({})
});

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-kiorel-api-key");
  if (!apiKey) return NextResponse.json({ error: "Missing x-kiorel-api-key" }, { status: 401 });

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: key } = await supabase.from("api_keys").select("id, website_id, revoked_at").eq("key_hash", apiKey).is("revoked_at", null).maybeSingle();
  if (!key || key.website_id !== parsed.data.website_id) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const { data: event, error } = await supabase.from("events").insert({
    website_id: parsed.data.website_id,
    api_key_id: key.id,
    event_name: parsed.data.event_name,
    event_id: parsed.data.event_id,
    event_time: parsed.data.event_time ?? new Date().toISOString(),
    properties: parsed.data.properties
  }).select("id, event_name, event_id, received_at").single();

  if (error) return NextResponse.json({ error: "Event could not be stored" }, { status: 500 });
  return NextResponse.json({ ok: true, event }, { status: 202 });
}