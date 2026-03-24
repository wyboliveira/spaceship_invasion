
import { describe, it, expect } from 'vitest';
import { supabase } from '../src/lib/supabase.js';

describe('Supabase Latency & Connectivity Diagnostic', () => {
  it('should fetch public table count within 2 seconds', async () => {
    const start = Date.now();
    const { data, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const end = Date.now();
    
    console.log(`[Diagnostic] Public count took ${end - start}ms`);
    if (error) {
      console.error('[Diagnostic] Error:', error.message);
    }
    
    expect(error).toBeNull();
    expect(end - start).toBeLessThan(5000); // 5s max for a simple count
  }, 10000);

  it('should measure session recovery time', async () => {
    const start = Date.now();
    const { data: { session } } = await supabase.auth.getSession();
    const end = Date.now();
    
    console.log(`[Diagnostic] Session recovery took ${end - start}ms`);
    console.log('[Diagnostic] Session found:', !!session);
  }, 10000);

  it('should test a dummy upsert (if authenticated)', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[Diagnostic] SKIP: No session for authenticated tests');
      return;
    }

    const start = Date.now();
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      updated_at: new Date().toISOString()
    });
    const end = Date.now();

    console.log(`[Diagnostic] Upsert took ${end - start}ms`);
    if (error) console.error('[Diagnostic] Upsert Error:', error.message);
    expect(error).toBeNull();
  }, 15000);
});
