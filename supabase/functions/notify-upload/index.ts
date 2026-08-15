import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let mediaId = url.searchParams.get("mediaId");

    // also support POST body
    if (!mediaId && req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.mediaId) mediaId = body.mediaId;
      } catch { /* ignore */ }
    }

    if (!mediaId) {
      return new Response(JSON.stringify({ error: "mediaId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // fetch the media + uploader
    const { data: media, error: mErr } = await supabase
      .from("media")
      .select("id, title, type, user_id")
      .eq("id", mediaId)
      .maybeSingle();
    if (mErr || !media) {
      return new Response(JSON.stringify({ error: "media not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // find users who opted into email notifications
    const { data: subscribers } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("email_notify", true);

    // fetch emails from auth.users for those subscribers
    const userIds = (subscribers ?? []).map((s) => s.id);
    let emails: string[] = [];
    if (userIds.length > 0) {
      const { data: authUsers } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      emails = (authUsers?.users ?? [])
        .filter((u) => userIds.includes(u.id) && u.email)
        .map((u) => u.email!);
    }

    // NOTE: actual email sending requires an SMTP/Resend secret configured.
    // For now we log the notification intent. To enable, set RESEND_API_KEY
    // or SMTP env vars and call the provider here.
    console.log(
      `[notify] New upload "${media.title}" (${media.type}) by ${media.user_id}. ` +
        `${emails.length} subscriber(s) would be notified.`,
    );

    return new Response(
      JSON.stringify({ ok: true, notified: emails.length, media: { id: media.id, title: media.title } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
