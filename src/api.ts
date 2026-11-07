import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FN = `${URL}/functions/v1/score`;

// Supabase client that authenticates with the Clerk session token (RLS uses its `sub` claim).
export const makeSupabase = (getToken: () => Promise<string | null>) =>
  createClient(URL, ANON, { accessToken: getToken });

export type Payload = {
  name: string; score: number; lines: number; level: number;
  pieces: number; seconds: number; clears: number[];
  client_game_id?: string;
};
export type SubmitResult = { rank: number | null; similar: { name: string; score: number }[] };

export async function submitScore(token: string | null, p: Payload): Promise<SubmitResult> {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function topScores(): Promise<{ name: string; score: number }[]> {
  const r = await fetch(FN);
  if (!r.ok) return [];
  return (await r.json()).top;
}
