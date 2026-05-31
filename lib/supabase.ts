import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://gevmwppimetuorsoukml.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdldm13cHBpbWV0dW9yc291a21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjA4MDksImV4cCI6MjA4ODAzNjgwOX0.89rBgX4iwMQcULQNwOGZykmBpPflBX3AcAHyM9kWV1E";

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
