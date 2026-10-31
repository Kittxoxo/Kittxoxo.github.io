const crypto = require("crypto");
const { cmd, pipe, getJSON, setJSON } = require("./_redis");
const { parsePlayers } = require("./_rank");

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
          await setJSON("hb:state", { status: "running", startedAt: Date.now(), duration: mins * 60000, resetAt: state.resetAt || 0 });
          return res.status(200).json({ ok: true });
        }
      case "adjust": { // add or remove time while a round exists
        if (state.status !== "running") return res.status(409).json({ error: "not running" });
        const d = Number(body.delta);
        if (!Number.isFinite(d) || Math.abs(d) > 60 * 60 * 1000) return res.status(400).json({ error: "delta" });
        state.duration = Math.min(4 * 60 * 60 * 1000, Math.max(10000, (state.duration || DURATION) + d));
        state.showcase = { open: false, rank: 1 };
        await setJSON("hb:state", state);
        return res.status(200).json({ ok: true, duration: state.duration });
      }
      case "endnow":
        if (state.status !== "running") return res.status(409).json({ error: "not running" });
        state.duration = Math.max(1000, Date.now() - state.startedAt);
        await setJSON("hb:state", state);
        return res.status(200).json({ ok: true });
      case "reset": // wipes everything: phones clear their cards when they see the new resetAt
        await clearPhotos();
        await setJSON("hb:state", { status: "waiting", resetAt: Date.now() });
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
      case "board": { // host-only live board: names, progress, tie-break times
        const [flat, photos] = await pipe([["HGETALL", "hb:prog"], ["LLEN", "hb:photos"]]);
        const players = parsePlayers(flat).map((p) => ({ pid: p.pid, name: p.name, mask: p.mask, t: p.t }));
        return res.status(200).json({ status: state.status, startedAt: state.startedAt || null, duration: state.duration || DURATION, players, photos: photos || 0 });
      }
      case "showcase": { // open/close the winners showcase for everyone, and pick which place is shown
        const r = Number(body.rank);
        if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: "rank 1-5" });
        const finished = state.status === "running" && Date.now() >= state.startedAt + (state.duration || DURATION);
        if (!finished) return res.status(409).json({ error: "round not finished" });
        state.showcase = { open: body.open !== false, rank: r };
        await setJSON("hb:state", state);
        return res.status(200).json({ ok: true });
      }
      case "thumbs": { // host-only: small pictures for the live board (cached by the page)
        const ids = Array.isArray(body.ids) ? body.ids.slice(0, 60) : [];
        if (!ids.every((id) => typeof id === "string" && /^[a-z0-9]{8,24}:\d{1,2}$/.test(id))) return res.status(400).json({ error: "ids" });
        if (!ids.length) return res.status(200).json({ items: [] });
        const vals = await cmd(["MGET", ...ids.map((id) => "hb:t:" + id)]);
        return res.status(200).json({ items: ids.map((id, k) => ({ id, src: vals[k] })).filter((x) => x.src) });
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
