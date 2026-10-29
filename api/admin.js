const crypto = require("crypto");
const { cmd, getJSON, setJSON } = require("./_redis");

const DURATION = 10 * 60 * 1000;

function okPassword(given) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

async function clearPhotos() {
  const ids = await cmd(["LRANGE", "hb:photos", 0, -1]);
  for (let k = 0; k < ids.length; k += 100) {
    const keys = [];
    ids.slice(k, k + 100).forEach((id) => keys.push("hb:t:" + id, "hb:f:" + id));
    await cmd(["DEL", ...keys]);
  }
  await cmd(["DEL", "hb:photos", "hb:ids", "hb:prog"]);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!okPassword(body.password)) return res.status(401).json({ error: "unauthorized" });

  try {
    const state = await getJSON("hb:state", { status: "waiting" });
    switch (body.action) {
      case "check":
        return res.status(200).json({ ok: true });
      case "start":
        if (state.status === "running") return res.status(409).json({ error: "already started" });
        {
          const mins = body.minutes == null ? 10 : Math.round(Number(body.minutes));
          if (!(mins >= 1 && mins <= 120)) return res.status(400).json({ error: "minutes 1-120" });
          await clearPhotos(); // a new round starts with an empty collage and live board
          await setJSON("hb:state", { status: "running", startedAt: Date.now(), duration: mins * 60000 });
          return res.status(200).json({ ok: true });
        }
      case "adjust": { // add or remove time while a round exists
        if (state.status !== "running") return res.status(409).json({ error: "not running" });
        const d = Number(body.delta);
        if (!Number.isFinite(d) || Math.abs(d) > 60 * 60 * 1000) return res.status(400).json({ error: "delta" });
        state.duration = Math.min(4 * 60 * 60 * 1000, Math.max(10000, (state.duration || DURATION) + d));
        await setJSON("hb:state", state);
        return res.status(200).json({ ok: true, duration: state.duration });
      }
      case "endnow":
        if (state.status !== "running") return res.status(409).json({ error: "not running" });
        state.duration = Math.max(1000, Date.now() - state.startedAt);
        await setJSON("hb:state", state);
        return res.status(200).json({ ok: true });
      case "reset":
        await setJSON("hb:state", { status: "waiting" });
        return res.status(200).json({ ok: true });
      case "prompts": {
        const p = body.prompts;
        if (!Array.isArray(p) || p.length !== 24 || !p.every((x) => typeof x === "string" && x.length <= 40))
          return res.status(400).json({ error: "bad prompts" });
        await setJSON("hb:prompts", p);
        return res.status(200).json({ ok: true });
      }
      case "photos": { // host-only: the bigger 400px pictures, for the zip download
        const cursor = Math.max(0, parseInt(body.cursor, 10) || 0);
        const limit = Math.min(20, Math.max(1, parseInt(body.limit, 10) || 20));
        const ids = await cmd(["LRANGE", "hb:photos", cursor, cursor + limit - 1]);
        if (!ids.length) return res.status(200).json({ items: [], next: null });
        const vals = await cmd(["MGET", ...ids.map((id) => "hb:f:" + id)]);
        const items = ids.map((id, k) => ({ id, src: vals[k] })).filter((x) => x.src);
        return res.status(200).json({ items, next: ids.length === limit ? cursor + limit : null });
      }
      case "clearphotos":
        await clearPhotos();
        return res.status(200).json({ ok: true });
      default:
        return res.status(400).json({ error: "bad action" });
    }
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
};
