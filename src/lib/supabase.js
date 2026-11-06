import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY =
	import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const POSTER_BUCKET = "posters";

export const isSupabaseConfigured = Boolean(
	SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = isSupabaseConfigured
	? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
	: null;

export function getPosterPublicUrl(path) {
	if (!supabase || !path) return "";
	return supabase.storage.from(POSTER_BUCKET).getPublicUrl(path).data.publicUrl;
}
