const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

export default supabase;