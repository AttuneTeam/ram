import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. It bypasses RLS, so it must only be used after the
 * caller has been checked by `requireWorkspace` / `loadWorkspace`.
 * Created per call (never at module level) so env is read at request time.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
