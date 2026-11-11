// Servidor local mínimo que imita a Vercel (solo para probar en tu computador): node dev-server.js
const http = require("http"), fs = require("fs"), path = require("path");
const handlers = { "/api/op": require("./api/op"), "/api/estado": require("./api/estado"), "/api/bitacora": require("./api/bitacora") };
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const h = handlers[u.pathname];
  if (h) {
    let raw = ""; req.on("data", (c) => (raw += c));
    req.on("end", () => { try { req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw; } catch (e) { req.body = raw; } h(req, res); });
    return;
  }
  const f = path.join(__dirname, "public", u.pathname === "/" ? "index.html" : u.pathname);
  if (!f.startsWith(path.join(__dirname, "public")) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("no encontrado"); }
  res.setHeader("Content-Type", f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"); res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log("http://localhost:" + PORT));
