// Participants upload a selfie here AFTER they agreed to share it with the host.
const { cmd, pipe, getJSON } = require("./_redis");

const DURATION = 10 * 60 * 1000;
const GRACE = 5 * 60 * 1000; // lets slow phones finish uploading after time is up

const isImg = (s, max) =>
  typeof s === "string" && s.length <= max && s.startsWith("data:image/jpeg;base64,") &&
  /^[A-Za-z0-9+/=]+$/.test(s.slice(23));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { pid, i, thumb, full } = b;
    if (typeof pid !== "string" || !/^[a-z0-9]{8,24}$/.test(pid)) return res.status(400).json({ error: "pid" });
    if (!Number.isInteger(i) || i < 0 || i > 24 || i === 12) return res.status(400).json({ error: "square" });
    if (!isImg(thumb, 30000) || !isImg(full, 160000)) return res.status(400).json({ error: "image" });

    const state = await getJSON("hb:state", { status: "waiting" });
    const now = Date.now();
    if (state.status !== "running" || now < state.startedAt || now > state.startedAt + (state.duration || DURATION) + GRACE)
      return res.status(403).json({ error: "round closed" });

    const id = pid + ":" + i;
    const isNew = await cmd(["SADD", "hb:ids", id]);
    if (isNew === 0) return res.status(200).json({ ok: true, duplicate: true });
    await pipe([
      ["SET", "hb:t:" + id, thumb],
      ["SET", "hb:f:" + id, full],
      ["RPUSH", "hb:photos", id],
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "server" });
  }
};
