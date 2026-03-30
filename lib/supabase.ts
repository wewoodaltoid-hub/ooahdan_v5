import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://gevmwppimetuorsoukml.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdldm13cHBpbWV0dW9yc291a21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjA4MDksImV4cCI6MjA4ODAzNjgwOX0.89rBgX4iwMQcULQNwOGZykmBpPflBX3AcAHyM9kWV1E";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
