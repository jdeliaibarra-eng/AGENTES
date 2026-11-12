"use strict";
// Capa de servicio: junta la base de datos con el motor de reglas y el agente.
// Cada operación: carga el catálogo, bloquea la sesión, ejecuta el agente, guarda el estado y devuelve lo nuevo.
const motor = require("./motor");
const ChatAgente = require("./core")(motor);
const config = require("./config.json");
const db = require("./db");
const llm = require("./llm");
const MAX_LLM = parseInt(process.env.LLM_MAX_POR_SESION || "60", 10); // tope de llamadas al modelo por sesión (control de gasto)

const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // si el cliente no manda fecha, se usa la de hoy
const RE_SESION = /^[A-Za-z0-9_-]{16,64}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const OPS = ["iniciar", "recibir", "resolver", "cliente", "reiniciar", "nuevo_cliente"];
const CANALES = ["Mayorista", "Minorista", "Bodega", "Autoservicio"];
const MAX_CLIENTES_NUEVOS = 5;

function limpiarFecha(f) { return RE_FECHA.test(f || "") ? f : hoyLima(); }
function error(status, mensaje) { const e = new Error(mensaje); e.status = status; return e; }

function armarRespuesta(agente, desde, resultado, extras) {
  return { ok: true, resultado: resultado === undefined ? null : resultado, nuevos: agente.mensajesDesde(desde), vista: agente.vista(), clientes_extra: extras || [] };
}

function limpiarTexto(x, max) { return String(x == null ? "" : x).replace(/<[^>]*>/g, " ").replace(/[^\p{L}\p{N} .,&'\/-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max); }

// Un cliente nuevo nace como lead en el CRM: todavía no está habilitado en el ERP ni tiene línea de crédito.
// El código (CLI-9xx) lo asigna la base al guardarlo.
function datosClienteNuevo(nuevo) {
  nuevo = nuevo || {};
  const nombre = limpiarTexto(nuevo.nombre_comercial, 60), razon = limpiarTexto(nuevo.razon_social, 90) || nombre;
  const canal = CANALES.indexOf(nuevo.canal) >= 0 ? nuevo.canal : "Mayorista", distrito = limpiarTexto(nuevo.distrito, 40);
  if (nombre.length < 2) throw error(400, "Escriba el nombre comercial del cliente (mínimo 2 letras).");
  return { razon_social: razon, nombre_comercial: nombre, canal: canal, distrito: distrito, estado_comercial: "Lead nuevo",
           habilitado_erp: "NO", linea_credito: "0", plazo_dias: "0", deuda_vigente: "0", compras_previas: "0" };
}

async function ejecutar(body) {
  body = body || {};
  if (!RE_SESION.test(body.sesion || "")) throw error(400, "Identificador de sesión inválido.");
  if (OPS.indexOf(body.op) < 0) throw error(400, "Operación desconocida.");
  const fecha = limpiarFecha(body.fecha);
  const desde = Number.isInteger(body.desde) ? body.desde : 0;
  const texto = typeof body.texto === "string" ? body.texto.slice(0, 600) : "";
  const tablas = await db.leerCatalogo();

  if (body.op === "iniciar" && Math.random() < 0.05) db.limpiarAntiguas().catch(() => {});

  // Los clientes nuevos se guardan en la tabla "clientes" de la base. Se leen en cada petición (sin caché) para que todas las instancias los vean.
  let nuevoCli = null;
  if (body.op === "nuevo_cliente") {
    const datosNuevo = datosClienteNuevo(body.nuevo);
    const previo = await db.leerSesion(body.sesion);
    if (((previo && previo.clientes_creados) || 0) >= MAX_CLIENTES_NUEVOS) throw error(400, "Ya creó el máximo de " + MAX_CLIENTES_NUEVOS + " clientes nuevos en esta sesión.");
    nuevoCli = await db.insertarClienteNuevo(datosNuevo);
  }
  const extras = await db.leerClientesNuevos();

  return db.conSesion(body.sesion, async (estadoPrevio) => {
    const errores = [];
    const baseClientes = tablas.clientes.filter((c) => c.origen !== db.ORIGEN_NUEVO);
    const D = { tablas: Object.assign({}, tablas, { clientes: baseClientes.concat(extras) }), config: config };
    const ids = D.tablas.clientes.map((c) => c.id_cliente);
    const cliente = nuevoCli ? nuevoCli.id_cliente : ids.indexOf(body.cliente) >= 0 ? body.cliente : "CLI-001";
    let usadasLlm = (estadoPrevio && estadoPrevio.llm_n) || 0;
    const interprete = llm.hayModelo() ? async (t, ctx) => { if (usadasLlm >= MAX_LLM) return null; usadasLlm++; return llm.interpretar(t, ctx); } : null;
    const agente = ChatAgente.crear({ D: D, cliente: cliente, hoy: () => fecha, estado: estadoPrevio, interprete: interprete, emit: (ev, d) => { if (ev === "error") errores.push(d); } });
    let resultado;
    if (body.op === "iniciar") {
      if (!estadoPrevio) { await agente.saludar(); }
    } else if (body.op === "reiniciar") {
      await agente.reiniciar(cliente); await agente.saludar();
    } else if (body.op === "nuevo_cliente") {
      await agente.setCliente(cliente); await agente.saludar();
    } else if (body.op === "cliente") {
      await agente.setCliente(cliente); await agente.saludar();
    } else if (body.op === "recibir") {
      if (!texto.trim()) throw error(400, "Mensaje vacío.");
      const a = body.accion && typeof body.accion === "object" ? body.accion : null;
      await agente.recibir(texto, a);
    } else if (body.op === "resolver") {
      if (typeof body.tarea !== "string") throw error(400, "Falta la tarea.");
      const dec = body.dec || {};
      resultado = await agente.resolver(body.tarea, { aprobar: !!dec.aprobar, valor: dec.valor, motivo: String(dec.motivo || "").slice(0, 200) });
    }
    errores.forEach((e) => console.error("[agente]", e && e.stack || e));
    const base = body.op === "iniciar" && estadoPrevio ? 0 : desde; // al volver a abrir la página se reenvía toda la conversación
    const estadoNuevo = agente.exportar(); estadoNuevo.llm_n = usadasLlm; estadoNuevo.clientes_creados = ((estadoPrevio && estadoPrevio.clientes_creados) || 0) + (nuevoCli ? 1 : 0);
    return { estado: estadoNuevo, respuesta: armarRespuesta(agente, body.op === "iniciar" ? 0 : base, resultado, extras) };
  });
}

// Lectura sin bloqueo: sirve para que el chat se entere de cambios (por ejemplo, desde otra pestaña).
async function leer(sesion, desde) {
  if (!RE_SESION.test(sesion || "")) throw error(400, "Identificador de sesión inválido.");
  const estado = await db.leerSesion(sesion);
  if (!estado || !estado.conv) return { ok: true, existe: false, nuevos: [], vista: null };
  const msgs = (estado.msgs || []).filter((m) => m.seq > (desde || 0));
  return { ok: true, existe: true, nuevos: msgs, vista: { cliente: estado.conv.cliente, conv: estado.conv, tareas: estado.tareas, traza: estado.traza, ultimoERP: estado.ultimoERP, rev: estado.rev, seq: estado.seq } };
}

async function csv(sesion) {
  if (!RE_SESION.test(sesion || "")) throw error(400, "Identificador de sesión inválido.");
  const estado = await db.leerSesion(sesion);
  return motor.bitacoraACsv((estado && estado.bit) || []);
}

module.exports = { ejecutar, leer, csv, hoyLima };
