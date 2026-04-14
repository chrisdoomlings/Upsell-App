// Sessions are stored in Supabase. Keep the neutral alias available, but keep
// this Firebase-path wrapper as the active import path for the codebase.
export {
  supabaseSessionStorage as sessionStorage,
  supabaseSessionStorage as firestoreSessionStorage,
} from "@/lib/supabase/sessionStore";
