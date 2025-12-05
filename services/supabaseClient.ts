import { createClient } from '@supabase/supabase-js';

// Supabase credentials - usando as credenciais reais fornecidas
const SUPABASE_URL = 'https://mdvhrmmdojkfqxobamtn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdmhybW1kb2prZnF4b2JhbXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjIzNjcsImV4cCI6MjA4MDUzODM2N30.D9ecpfZhmNA9LAdO1AWxSLRbzglscZbDUUUGVLt_9gc';

// Inicializa o cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);