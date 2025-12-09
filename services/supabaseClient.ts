const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Supabase URL and key must be defined in environment variables');
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

export default supabase;