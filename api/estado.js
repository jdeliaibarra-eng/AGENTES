"use strict";
const servicio = require("../lib/servicio");

// GET /api/estado?sesion=...&desde=N  → mensajes nuevos y vista actual (sin modificar nada)
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(req.url, "http://x");
    const r = await servicio.leer(url.searchParams.get("sesion"), parseInt(url.searchParams.get("desde") || "0", 10) || 0);
    res.statusCode = 200; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(r));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error("[api/estado]", e);
    res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: status === 500 ? "Error interno del servidor." : e.message }));
  }
};
