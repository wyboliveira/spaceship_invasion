
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('--- Supabase Diagnostic Test ---');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('\n1. Testing raw public table access (if any)...');
  const { data: pData, error: pError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  if (pError) console.error('Public fetch error:', pError.message, pError.details, pError.hint);
  else console.log('Public fetch success! Count:', pData);

  console.log('\n2. Checking auth status...');
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Current local session:', session ? 'Found (User ID: ' + session.user.id + ')' : 'None');

  if (session) {
    console.log('\n3. Testing profile fetch for current user...');
    const start = Date.now();
    const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    const end = Date.now();
    console.log(`Fetch took ${end - start}ms`);
    if (profErr) console.error('Profile fetch error:', profErr.message);
    else console.log('Profile found:', prof);
  } else {
    console.log('\n3. SKIPPED: No session to test profile fetch.');
  }

  console.log('\n--- Diagnostic Complete ---');
}

runTest().catch(err => console.error('Fatal test error:', err));
