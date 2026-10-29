// Participants report WHICH squares they filled (a number, no photos, no names).
const { cmd, pipe, getJSON } = require("./_redis");

const DURATION = 10 * 60 * 1000;
const GRACE = 60 * 1000;
const MAX_PLAYERS = 600;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { pid, mask } = b;
    if (typeof pid !== "string" || !/^[a-z0-9]{8,24}$/.test(pid)) return res.status(400).json({ error: "pid" });
    if (!Number.isInteger(mask) || mask < 0 || mask >= 1 << 25) return res.status(400).json({ error: "mask" });

    const state = await getJSON("hb:state", { status: "waiting" });
    const now = Date.now();
    if (state.status !== "running" || now < state.startedAt || now > state.startedAt + (state.duration || DURATION) + GRACE)
      return res.status(403).json({ error: "round closed" });

    const [exists, count] = await pipe([["HEXISTS", "hb:prog", pid], ["HLEN", "hb:prog"]]);
    if (!exists && count >= MAX_PLAYERS) return res.status(429).json({ error: "full" });
    await cmd(["HSET", "hb:prog", pid, String(mask)]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
};
