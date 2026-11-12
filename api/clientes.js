"use strict";
const servicio = require("../lib/servicio");

// GET /api/clientes  → todos los clientes de la tabla, con su situación (lead o activo)
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const lista = await servicio.clientes();
    res.statusCode = 200; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, clientes: lista }));
  } catch (e) {
    console.error("[api/clientes]", e);
    res.statusCode = 500; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Error interno del servidor." }));
  }
};
