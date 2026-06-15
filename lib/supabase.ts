import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

export const supabaseUrl = "https://gevmwppimetuorsoukml.supabase.co";
export const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdldm13cHBpbWV0dW9yc291a21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjA4MDksImV4cCI6MjA4ODAzNjgwOX0.89rBgX4iwMQcULQNwOGZykmBpPflBX3AcAHyM9kWV1E";

export const SUPABASE_DASHBOARD_URL =
  "https://supabase.com/dashboard/project/gevmwppimetuorsoukml";

export function isNetworkAuthError(error: unknown): boolean {
  if (error == null) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Network request failed") ||
    message.includes("Failed to fetch") ||
    message.includes("AuthRetryableFetchError")
  );
}

/** Supabase API가 응답하는지 확인 (일시 중지·DNS 오류 등 감지) */
export async function isSupabaseReachable(): Promise<boolean> {
  if (typeof fetch !== "function") return true;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: supabaseAnonKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 서버에 연결할 수 없을 때 로컬 세션을 지워 토큰 갱신 재시도 루프를 막음 */
export async function clearLocalAuthSession(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}

/** Expo static export / Metro Node 측에서는 `window`가 없어 AsyncStorage가 크래시남 */
function createAuthStorage(): SupportedStorage {
  if (typeof window === "undefined") {
    const mem = new Map<string, string>();
    return {
      getItem: async (key) => mem.get(key) ?? null,
      setItem: async (key, value) => {
        mem.set(key, value);
      },
      removeItem: async (key) => {
        mem.delete(key);
      },
    };
  }
  return AsyncStorage;
}

const isNodeRuntime = typeof window === "undefined";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createAuthStorage(),
    autoRefreshToken: !isNodeRuntime,
    persistSession: !isNodeRuntime,
    detectSessionInUrl: false,
  },
});
