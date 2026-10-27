import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createHandler } from "./core.mjs";
const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function rpc(name: string, args: Record<string, unknown>) {
  const r = await service.rpc(name, args);
  if (r.error) throw r.error;
  return r.data;
}
Deno.serve(
  createHandler({
    load: (h: string) => rpc("sdr_intake_load", { p_token_hash: h }),
    submit: (args: Record<string, unknown>) =>
      rpc("sdr_intake_submit", args),
    admin: async (header: string) => {
      if (!header.startsWith("Bearer ")) return false;
      const user = await service.auth.getUser(header.slice(7));
      if (user.error || !user.data.user) return false;
      const r = await service
        .from("app_admins")
        .select("user_id")
        .eq("user_id", user.data.user.id)
        .maybeSingle();
      return !r.error && r.data ? user.data.user.id : false;
    },
    issue: async (row: Record<string, unknown>) => {
      const r = await service.from("sdr_intake_links").insert(row);
      if (r.error) throw r.error;
    },
    revoke: async (id: string) => {
      const r = await service
        .from("sdr_intake_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (r.error) throw r.error;
    },
  }),
);
