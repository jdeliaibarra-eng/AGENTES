"use strict";
const servicio = require("../lib/servicio");

// POST /api/op  { sesion, op, cliente?, fecha?, texto?, accion?, tarea?, dec?, desde? }
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end(JSON.stringify({ ok: false, error: "Use POST." })); }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const r = await servicio.ejecutar(body);
    res.statusCode = 200; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(r));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error("[api/op]", e);
    res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: status === 500 ? "Error interno del servidor." : e.message }));
  }
};
