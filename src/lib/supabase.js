import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.SUPABASE_URL;
const supabasePublishableKey = import.meta.env?.SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, { auth: { flowType: 'pkce' } })
    : null;

if (!supabase && import.meta.env) {
  console.warn(
    'Supabase is not configured. Add your project URL and publishable key to .env.',
  );
}
