import { recoverMessageAddress, getAddress } from "viem";

/**
 * Per-wallet cross-device sync store for the messenger (Saved Messages + preferences).
 * The client stores an ENCRYPTED blob (XChaCha20-Poly1305, key derived from a wallet
 * signature) keyed by address — the server only ever holds ciphertext. Reads are
 * public (the blob is encrypted; only the owner's wallet can decrypt it); writes must
 * carry a signature of SYNC_MESSAGE that recovers to the claimed address.
 *
 * Vercel KV / Upstash inject these when you connect a store:
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (or UPSTASH_REDIS_REST_URL / _TOKEN)
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = "bittrees:usersync:"; // + <addrLower> → { blob, updatedAt }
const MAX_BLOB = 400_000; // ~400 KB ciphertext cap

// MUST match SYNC_MESSAGE in src/lib/userSync.ts exactly.
const SYNC_MESSAGE =
  "Bittrees Messenger — sync key (v1)\n\nSign to sync and encrypt your saved messages and preferences across your devices. No gas; this only proves wallet ownership.";

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

const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || ""));

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const address = String(req.query.address || "");
      if (!isAddr(address)) return res.status(400).json({ error: "bad address" });
      const data = await readJson(PREFIX + address.toLowerCase(), null);
      return res.status(200).json(data || { blob: null, updatedAt: 0 });
    }

    if (req.method === "POST") {
      if (!KV_URL || !KV_TOKEN) return res.status(503).json({ error: "sync storage not configured" });
      const { address, signature, blob, updatedAt } = req.body || {};
      if (!isAddr(address) || typeof signature !== "string" || typeof blob !== "string") {
        return res.status(400).json({ error: "bad request" });
      }
      if (blob.length > MAX_BLOB) return res.status(413).json({ error: "blob too large" });
      let signer;
      try {
        signer = await recoverMessageAddress({ message: SYNC_MESSAGE, signature });
      } catch {
        return res.status(401).json({ error: "bad signature" });
      }
      if (getAddress(signer) !== getAddress(address)) {
        return res.status(403).json({ error: "signature does not match address" });
      }
      await writeJson(PREFIX + address.toLowerCase(), { blob, updatedAt: Number(updatedAt) || Date.now() });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
