const BASE = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function post(path, body) {
  if (!BASE || !TOKEN) throw new Error("Redis env vars missing");
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function cmd(args) {
  const j = await post("", args);
  if (j.error) throw new Error(j.error);
  return j.result;
}

// several commands in one HTTP request
async function pipe(cmds) {
  const j = await post("/pipeline", cmds);
  if (!Array.isArray(j)) throw new Error("pipeline failed");
  return j.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

async function getJSON(key, fallback) {
  const v = await cmd(["GET", key]);
  return v ? JSON.parse(v) : fallback;
}
const setJSON = (key, val) => cmd(["SET", key, JSON.stringify(val)]);

module.exports = { cmd, pipe, getJSON, setJSON };
