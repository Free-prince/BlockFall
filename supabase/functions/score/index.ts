// GET  -> global top 10 (Upstash Redis sorted set)
// POST -> verify Clerk JWT, save to Supabase, update Redis leaderboard, upsert/query Pinecone playstyle vector
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const env = (k: string) => Deno.env.get(k)!;
const JWKS = createRemoteJWKSet(new URL(env("CLERK_JWKS_URL")));
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const redis = async (cmds: (string | number)[][]) =>
  (await fetch(`${env("UPSTASH_REDIS_REST_URL")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("UPSTASH_REDIS_REST_TOKEN")}` },
    body: JSON.stringify(cmds),
  })).json();

const pine = (path: string, body: unknown) =>
  fetch(`${env("PINECONE_INDEX_HOST")}${path}`, {
    method: "POST",
    headers: {
      "Api-Key": env("PINECONE_API_KEY"),
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2025-04",
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const int = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method === "GET") {
    const [{ result: flat }] = await redis([["ZREVRANGE", "leaderboard", 0, 9, "WITHSCORES"]]);
    const ids: string[] = flat.filter((_: string, i: number) => i % 2 === 0);
    if (!ids.length) return json({ top: [] });
    const [{ result: names }] = await redis([["HMGET", "names", ...ids]]);
    return json({ top: ids.map((_, i) => ({ name: names[i] ?? "player", score: Number(flat[i * 2 + 1]) })) });
  }

  try {
    const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    const { payload } = await jwtVerify(token, JWKS);
    const uid = payload.sub!;
    const b = await req.json();
    const clears: number[] = b.clears;
    if (!int(b.score, 5_000_000) || !int(b.lines, 5000) || !int(b.level, 500) || !int(b.pieces, 50000) ||
        !int(b.seconds, 86400) || !Array.isArray(clears) || clears.length !== 4 || !clears.every((c) => int(c, 5000)))
      return json({ error: "invalid payload" }, 400);
    const name = String(b.name ?? "player").slice(0, 20);

    const { error } = await db.from("scores").insert({
      user_id: uid, name, score: b.score, lines: b.lines, level: b.level,
      pieces: b.pieces, seconds: b.seconds, clears,
    });
    if (error) throw error;

    const [, , rank] = await redis([
      ["ZADD", "leaderboard", "GT", b.score, uid],
      ["HSET", "names", uid, name],
      ["ZREVRANK", "leaderboard", uid],
    ]);

    // 8-dim "playstyle" vector: progress + how the player clears lines
    const c = (n: number, d: number) => Math.min(1, n / d);
    const tot = Math.max(1, clears.reduce((x, y) => x + y, 0));
    const values = [
      c(b.score, 50000), c(b.lines, 150), c(b.level, 15),
      clears[0] / tot, clears[1] / tot, clears[2] / tot, clears[3] / tot, c(b.seconds, 600),
    ].map((v) => v + 0.001);

    await pine("/vectors/upsert", { vectors: [{ id: uid, values, metadata: { name, score: b.score } }] });
    const q = await pine("/query", { vector: values, topK: 4, includeMetadata: true });
    const similar = (q.matches ?? [])
      .filter((m: any) => m.id !== uid)
      .slice(0, 3)
      .map((m: any) => ({ name: m.metadata?.name ?? "player", score: m.metadata?.score ?? 0 }));

    return json({ rank: rank.result == null ? null : rank.result + 1, similar });
  } catch (e) {
    return json({ error: String(e) }, 401);
  }
});
