import { recoverMessageAddress, getAddress } from "viem";

/**
 * Community-room registry — built-in room chatIds AND admin-created custom rooms
 * (each with its own gate), so creating a room makes it live for everyone with no
 * redeploy. Backed by Vercel KV / Upstash Redis over its REST API (no SDK). Reads
 * are public; writes require a signature from a live gov.bittrees.eth space admin.
 *
 * Vercel KV / Upstash inject these when you connect a store:
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (or UPSTASH_REDIS_REST_URL / _TOKEN)
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ROOMS_KEY = "bittrees:rooms"; // { roomKey: chatId } for built-in rooms
const CUSTOM_KEY = "bittrees:customrooms"; // [{ key, name, blurb, gate, chatId }]
const SNAPSHOT_SPACE = "gov.bittrees.eth";
const REPLAY_WINDOW_MS = 10 * 60 * 1000;

async function kvCommand(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`KV HTTP ${r.status}`);
  return r.json();
}
async function readJson(key, fallback) {
  if (!KV_URL || !KV_TOKEN) return fallback;
  try {
    const j = await kvCommand(["GET", key]);
    return j?.result ? JSON.parse(j.result) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJson(key, value) {
  await kvCommand(["SET", key, JSON.stringify(value)]);
}

async function spaceAdmins() {
  try {
    const r = await fetch("https://hub.snapshot.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "query($id:String!){ space(id:$id){ admins } }", variables: { id: SNAPSHOT_SPACE } }),
    });
    const j = await r.json();
    return (j?.data?.space?.admins ?? []).map((a) => String(a).toLowerCase());
  } catch {
    return [];
  }
}

const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || ""));

function validRule(r) {
  if (!r || typeof r !== "object") return false;
  if (r.kind === "bgov") return Number.isFinite(Number(r.tier)) && Number(r.tier) >= 0;
  if (r.kind === "safe") return isAddr(r.safe);
  if (r.kind === "token") return (r.standard === "erc20" || r.standard === "erc721") && isAddr(r.token) && /^\d+$/.test(String(r.min || ""));
  if (r.kind === "ens") return r.name === undefined || r.name === "" || (typeof r.name === "string" && /\./.test(r.name) && r.name.length <= 80);
  if (r.kind === "role") return typeof r.role === "string" && r.role.trim().length > 0 && r.role.length <= 64;
  return false;
}
function validGate(g) {
  if (!g || typeof g !== "object") return false;
  if (g.kind === "multi") return Array.isArray(g.rules) && g.rules.length > 0 && g.rules.length <= 8 && g.rules.every(validRule);
  return validRule(g);
}

/** Verify the request is signed by a live gov.bittrees.eth admin over `message`. */
async function verifyAdmin(address, signature, message) {
  if (!isAddr(address)) return { ok: false, code: 400, error: "invalid address" };
  let recovered;
  try {
    recovered = await recoverMessageAddress({ message, signature });
  } catch {
    return { ok: false, code: 400, error: "bad signature" };
  }
  const admins = await spaceAdmins();
  if (admins.length === 0) return { ok: false, code: 503, error: "could not verify admins" };
  if (getAddress(recovered) !== getAddress(address) || !admins.includes(recovered.toLowerCase())) {
    return { ok: false, code: 403, error: "signer is not a space admin" };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-store");

  if (req.method === "GET") {
    const rooms = await readJson(ROOMS_KEY, {});
    const custom = await readJson(CUSTOM_KEY, []);
    res.status(200).json({ rooms: rooms || {}, custom: custom || [] });
    return;
  }

  if (req.method === "POST") {
    if (!KV_URL || !KV_TOKEN) {
      res.status(503).json({ error: "registry not configured" });
      return;
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { address, signature, timestamp } = body;
      if (!address || !signature || !timestamp) {
        res.status(400).json({ error: "missing fields" });
        return;
      }
      if (!Number.isFinite(Number(timestamp)) || Math.abs(Date.now() - Number(timestamp)) > REPLAY_WINDOW_MS) {
        res.status(400).json({ error: "stale or invalid timestamp" });
        return;
      }

      // Delete a custom room.
      if (body.deleteCustom) {
        const key = String(body.deleteCustom);
        const v = await verifyAdmin(address, signature, `Bittrees rooms registry\ndelete-custom ${key}\nat ${timestamp}`);
        if (!v.ok) { res.status(v.code).json({ error: v.error }); return; }
        const custom = (await readJson(CUSTOM_KEY, [])) || [];
        const next = custom.filter((r) => r.key !== key);
        await writeJson(CUSTOM_KEY, next);
        res.status(200).json({ ok: true, custom: next });
        return;
      }

      // Add / replace a custom room.
      if (body.custom) {
        const room = body.custom;
        if (!room.key || !room.name || !room.chatId || !validGate(room.gate)) {
          res.status(400).json({ error: "invalid custom room" });
          return;
        }
        const v = await verifyAdmin(address, signature, `Bittrees rooms registry\ncustom ${room.key}\nat ${timestamp}`);
        if (!v.ok) { res.status(v.code).json({ error: v.error }); return; }
        const clean = {
          key: String(room.key).slice(0, 64),
          name: String(room.name).slice(0, 80),
          blurb: String(room.blurb || "").slice(0, 160),
          gate: room.gate,
          chatId: String(room.chatId).slice(0, 200),
        };
        const custom = (await readJson(CUSTOM_KEY, [])) || [];
        const next = [...custom.filter((r) => r.key !== clean.key), clean];
        await writeJson(CUSTOM_KEY, next);
        res.status(200).json({ ok: true, custom: next });
        return;
      }

      // Set a built-in room's chatId.
      const { roomKey, chatId } = body;
      if (!roomKey || !chatId) {
        res.status(400).json({ error: "missing fields" });
        return;
      }
      const v = await verifyAdmin(address, signature, `Bittrees rooms registry\nset ${roomKey} = ${chatId}\nat ${timestamp}`);
      if (!v.ok) { res.status(v.code).json({ error: v.error }); return; }
      const rooms = (await readJson(ROOMS_KEY, {})) || {};
      rooms[roomKey] = chatId;
      await writeJson(ROOMS_KEY, rooms);
      res.status(200).json({ ok: true, rooms });
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
