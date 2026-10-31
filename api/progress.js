// Participants report WHICH boxes they filled (a number) plus their name.
const { cmd, pipe, getJSON } = require("./_redis");
const { bits } = require("./_rank");

const DURATION = 10 * 60 * 1000;
const GRACE = 60 * 1000;
const MAX_PLAYERS = 600;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { pid, mask } = b;
    const name = String(b.name || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
    if (name.length < 2) return res.status(400).json({ error: "name" });
    if (typeof pid !== "string" || !/^[a-z0-9]{8,24}$/.test(pid)) return res.status(400).json({ error: "pid" });
    if (!Number.isInteger(mask) || mask < 0 || mask >= 1 << 25) return res.status(400).json({ error: "mask" });

    const state = await getJSON("hb:state", { status: "waiting" });
    const now = Date.now();
    if (state.status !== "running" || now < state.startedAt || now > state.startedAt + (state.duration || DURATION) + GRACE)
      return res.status(403).json({ error: "round closed" });

    const [prev, count] = await pipe([["HGET", "hb:prog", pid], ["HLEN", "hb:prog"]]);
    if (prev == null && count >= MAX_PLAYERS) return res.status(429).json({ error: "full" });
    // t = when they reached their current number of boxes (used to break ties: earlier wins)
    let t = now;
    if (prev) {
      try { const o = JSON.parse(prev); if (bits(o.m) >= bits(mask) && o.t) t = o.t; } catch (e) {}
    }
    await cmd(["HSET", "hb:prog", pid, JSON.stringify({ m: mask, n: name, t })]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
};
