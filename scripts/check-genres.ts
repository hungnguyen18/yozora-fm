import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() ?? '';
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() ?? '';
const sb = createClient(url, key);

async function main() {
  const genres = ['rock', 'ballad', 'electronic', 'pop', 'orchestral', 'other'];
  for (let i = 0; i < genres.length; i += 1) {
    const { count } = await sb.from('songs').select('*', { count: 'exact', head: true }).eq('genre', genres[i]);
    console.log(genres[i], '→', count);
  }
  const { count: nullCount } = await sb.from('songs').select('*', { count: 'exact', head: true }).is('genre', null);
  console.log('NULL →', nullCount);
  const { count: total } = await sb.from('songs').select('*', { count: 'exact', head: true });
  console.log('TOTAL →', total);
}
main();
