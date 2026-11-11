
/*
 * Agente SIE comercial - GE703 PC3 - Grupo 6 - GLORIA
 * Motor de reglas en JavaScript (sin librerías, funciona sin internet).
 *
 * Es la MISMA lógica que python/motor.py, línea por línea: mismas reglas,
 * mismas causas, mismo orden de prioridad y el mismo cálculo en enteros
 * (dinero en centavos, porcentajes en puntos básicos: 1 % = 100 pb).
 * La prueba pruebas/comparar_motores.py ejecuta los 22 casos en ambos motores
 * y exige que los resultados sean idénticos.
 *
 * Qué NO hace: no aprueba descuentos ni crédito, no modifica precios ni stock,
 * no crea pedidos reales. "ACEPTADA" produce un ID de pedido SIMULADO.
 */
(function (raiz) {
  "use strict";

  var VERSION_MOTOR = "1.0.0";
  var TABLAS = ["productos", "clientes", "stock_lotes", "aprobaciones"];

  // ------------------------------------------------------------ utilidades
  function floorDiv(a, b) {
    var q = Math.floor(a / b);
    if ((q + 1) * b <= a) q += 1; // corrige redondeos de coma flotante
    else if (q * b > a) q -= 1;
    return q;
  }
  function rhu(n, d) { return floorDiv(2 * n + d, 2 * d); } // mitad hacia arriba (d > 0)
  function pyRound(x) { // round() de Python: mitad al par
    var r = Math.round(x);
    if (Math.abs(x % 1) === 0.5) r = 2 * Math.round(x / 2);
    return r;
  }
  var RE_NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  /** Decimal exacto -> entero escalado (mitad hacia arriba), sin errores de coma flotante. */
  function decAEntero(x, escala) {
    var s = String(x).trim();
    if (!RE_NUM.test(s)) throw new Error("Número no válido: '" + s + "'");
    var m = /^([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(s);
    var digitos = (m[2] || "") + (m[3] || "");
    if (digitos === "") digitos = "0";
    var exp = (m[4] ? parseInt(m[4], 10) : 0) - (m[3] || "").length + escala;
    var v = BigInt(digitos), res;
    if (exp >= 0) res = v * (BigInt(10) ** BigInt(exp));
    else {
      var p = BigInt(10) ** BigInt(-exp);
      res = v / p;
      if (BigInt(2) * (v % p) >= p) res += BigInt(1);
    }
    var n = Number(res);
    return m[1] === "-" ? -n : n;
  }
  function cents(x) { return decAEntero(x, 2); }
  function pctABp(x) { return decAEntero(x, 2); }
  function m(c) { return c === null || c === undefined ? null : c / 100; }
  function bpAPct(bp) { return bp === null || bp === undefined ? null : bp / 100; }
  function esFecha(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 1) return false;
    var t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }
  function utc(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }
  function sumaDias(iso, n) {
    var t = new Date(utc(iso) + n * 86400000);
    var y = t.getUTCFullYear();
    if (y > 9999 || y < 1) return iso;
    return ("0000" + y).slice(-4) + "-" + ("0" + (t.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + t.getUTCDate()).slice(-2);
  }
  function dias(a, b) { return Math.round((utc(a) - utc(b)) / 86400000); }
  function vacio(v) { return v === null || v === undefined || v === ""; }
  function esObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function pyBool(v) {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (esObj(v)) return Object.keys(v).length > 0;
    return !!v;
  }
  function f2(x) { return x.toFixed(2); }
  function f1(x) { return x.toFixed(1); }
  function cadena(v) { return String(v).trim(); }
  function enteroEstricto(v) { // int(v) de Python para texto
    var s = String(v).trim();
    if (!/^[+-]?\d+$/.test(s)) throw new Error("no entero");
    return parseInt(s, 10);
  }

  // --------------------------------------------------------- carga de datos
  /** Convierte filas de texto (como los CSV) en las estructuras del motor. */
  function cargarDatos(filas) {
    var productos = {}, clientes = {}, stock = [], aprobaciones = [];
    function ent(v) { return vacio(v) ? null : enteroEstricto(v); }
    (filas.productos || []).forEach(function (r) {
      productos[r.id_producto] = {
        id_producto: r.id_producto, sku: r.sku, nombre: r.nombre, familia: r.familia, presentacion: r.presentacion,
        unid_caja: ent(r.unid_caja), conservacion: r.conservacion, vida_util_dias: ent(r.vida_util_dias),
        precio_cents: cents(r.precio_base_caja), costo_cents: vacio(r.costo_caja) ? null : cents(r.costo_caja),
        margen_min_bp: vacio(r.margen_minimo_pct) ? null : pctABp(r.margen_minimo_pct),
        vida_min_entrega_pct: ent(r.vida_util_min_entrega_pct), origen: r.origen
      };
    });
    (filas.clientes || []).forEach(function (r) {
      clientes[r.id_cliente] = {
        id_cliente: r.id_cliente, cuenta_crm: r.cuenta_crm, razon_social: r.razon_social, nombre_comercial: r.nombre_comercial,
        canal: r.canal, distrito: r.distrito, estado_comercial: r.estado_comercial,
        habilitado: ["SI", "SÍ", "TRUE", "1"].indexOf(String(r.habilitado_erp).trim().toUpperCase()) >= 0,
        linea_cents: vacio(r.linea_credito) ? 0 : cents(r.linea_credito), plazo_dias: vacio(r.plazo_dias) ? 0 : enteroEstricto(r.plazo_dias),
        deuda_cents: vacio(r.deuda_vigente) ? 0 : cents(r.deuda_vigente), compras_previas: vacio(r.compras_previas) ? 0 : enteroEstricto(r.compras_previas),
        origen: r.origen
      };
    });
    (filas.stock_lotes || []).forEach(function (r) {
      stock.push({
        fecha_corte: r.fecha_corte, id_lote: r.id_lote, id_producto: r.id_producto, almacen: r.almacen, cajas: enteroEstricto(r.cajas),
        estado_calidad: String(r.estado_calidad).trim().toUpperCase(), fecha_produccion: r.fecha_produccion || null,
        fecha_vencimiento: r.fecha_vencimiento || null, reposicion_cajas: ent(r.reposicion_cajas),
        reposicion_fecha: r.reposicion_fecha || null, reposicion_ref: r.reposicion_ref || null, origen: r.origen
      });
    });
    (filas.aprobaciones || []).forEach(function (r) {
      var tipo = String(r.tipo).trim().toUpperCase();
      aprobaciones.push({
        id_aprobacion: r.id_aprobacion, tipo: tipo, rol: String(r.rol_aprobador).trim().toUpperCase(), aplica_a: r.aplica_a,
        valor_max: tipo === "DESCUENTO" ? pctABp(r.valor_maximo) : cents(r.valor_maximo),
        vigente_hasta: r.vigente_hasta || null, motivo: r.motivo, origen: r.origen
      });
    });
    return { productos: productos, clientes: clientes, stock: stock, aprobaciones: aprobaciones };
  }

  function nuevoEstado() {
    return { pedidos: [], reservas: [], aprobaciones: [], promesas: [], contadores: { SOL: 0, AUT: 0, APR: 0 } };
  }

  // ---------------------------------------------------------- normalización
  function normalizar(entrada, cfg, hoy, modo) {
    var err = [], adv = [];
    var e = esObj(entrada) ? entrada : {};
    function sub(k) { return esObj(e[k]) ? e[k] : {}; }
    var cot = sub("cotizacion"), sol = sub("solicitud"), apr = sub("aprobaciones");
    var n = {};

    n.id_cliente = vacio(e.cliente) ? null : cadena(e.cliente);
    if (!n.id_cliente) err.push(["FALTANTE", "cliente", "Falta el cliente (identidad)."]);

    // fechas
    var fSol = sol.fecha;
    if (vacio(fSol)) {
      fSol = hoy;
      if (modo === "solicitar") adv.push("No se informó la fecha de la solicitud: se usó la fecha del sistema (" + hoy + ").");
    }
    if (!esFecha(fSol)) {
      err.push(["INVALIDO", "solicitud.fecha", "La fecha de la solicitud debe tener formato AAAA-MM-DD."]);
      fSol = hoy;
    }
    n.fecha_solicitud = fSol;

    var fEmi = cot.fecha_emision;
    if (vacio(fEmi)) {
      fEmi = fSol;
      adv.push("No se informó la fecha de emisión de la cotización: se usó " + fEmi + ".");
    }
    if (!esFecha(fEmi)) {
      err.push(["INVALIDO", "cotizacion.fecha_emision", "La fecha de emisión debe tener formato AAAA-MM-DD."]);
      fEmi = fSol;
    }
    n.fecha_emision = fEmi;

    var vig = cot.vigencia_hasta;
    if (vacio(vig)) {
      vig = sumaDias(fEmi, cfg.vigencia_dias_defecto);
      adv.push("No se informó la vigencia: se asumió emisión + " + cfg.vigencia_dias_defecto + " días (" + vig + ").");
    }
    if (!esFecha(vig)) {
      err.push(["INVALIDO", "cotizacion.vigencia_hasta", "La vigencia debe tener formato AAAA-MM-DD."]);
      vig = sumaDias(fEmi, cfg.vigencia_dias_defecto);
    }
    n.vigencia_hasta = vig;

    var ent = sol.entrega_solicitada;
    if (vacio(ent)) {
      ent = sumaDias(fSol, cfg.dias_entrega_defecto);
      if (modo === "solicitar") adv.push("No se informó la fecha de entrega solicitada: se asumió solicitud + " + cfg.dias_entrega_defecto + " días (" + ent + ").");
    }
    if (!esFecha(ent)) {
      err.push(["INVALIDO", "solicitud.entrega_solicitada", "La entrega solicitada debe tener formato AAAA-MM-DD."]);
      ent = sumaDias(fSol, cfg.dias_entrega_defecto);
    }
    n.entrega_solicitada = ent;
    n.modalidad = sol.modalidad || "UNICA";

    // cotización
    var cid = cot.id;
    if (vacio(cid)) {
      if (modo === "solicitar") err.push(["FALTANTE", "cotizacion.id", "Falta el ID de la cotización (sin identificadores la solicitud no se envía)."]);
      cid = "COT-AUTO";
    }
    n.cot_id = cadena(cid);
    var ver = cot.version, verI;
    try {
      if (typeof ver === "boolean") throw new Error("bool");
      if (vacio(ver)) verI = null;
      else if (typeof ver === "number") { if (!isFinite(ver)) throw new Error("nan"); verI = Math.trunc(ver); }
      else verI = enteroEstricto(ver);
    } catch (x) {
      verI = null;
      err.push(["INVALIDO", "cotizacion.version", "La versión de la cotización debe ser un entero positivo."]);
    }
    if (verI === null) {
      if (vacio(ver) && modo === "solicitar") err.push(["FALTANTE", "cotizacion.version", "Falta la versión de la cotización."]);
      verI = 1;
    }
    if (verI < 1) {
      err.push(["INVALIDO", "cotizacion.version", "La versión de la cotización debe ser un entero positivo."]);
      verI = 1;
    }
    n.cot_version = verI;
    n.etiqueta = n.cot_id + "-V" + ("0" + verI).slice(-2);

    var acep = cot.aceptada;
    if (modo === "solicitar") {
      if (acep === null || acep === undefined || acep === "") {
        err.push(["FALTANTE", "cotizacion.aceptada", "Indique si el cliente aceptó la cotización."]);
        acep = false;
      } else if (typeof acep !== "boolean") {
        err.push(["INVALIDO", "cotizacion.aceptada", "El campo 'aceptada' debe ser verdadero o falso."]);
        acep = false;
      }
    }
    n.aceptada = pyBool(acep);
    var fAc = cot.fecha_aceptacion;
    if (vacio(fAc)) {
      fAc = n.aceptada ? fSol : null;
      if (n.aceptada) adv.push("No se informó la fecha de aceptación: se asumió la fecha de la solicitud (" + fSol + ").");
    } else if (!esFecha(fAc)) {
      err.push(["INVALIDO", "cotizacion.fecha_aceptacion", "La fecha de aceptación debe tener formato AAAA-MM-DD."]);
      fAc = fSol;
    }
    n.fecha_aceptacion = fAc;

    // líneas
    var lineas = [], vistos = {};
    var raw = e.lineas;
    if (!Array.isArray(raw) || raw.length === 0) {
      err.push(["FALTANTE", "lineas", "Falta al menos una línea (producto y cajas)."]);
    } else {
      raw.forEach(function (ln0, idx) {
        var i = idx + 1, ln = esObj(ln0) ? ln0 : {};
        var pid = vacio(ln.id_producto) ? null : cadena(ln.id_producto);
        if (!pid) { err.push(["FALTANTE", "lineas[" + i + "].id_producto", "Línea " + i + ": falta el código de producto."]); return; }
        var c = ln.cajas;
        try {
          if (typeof c === "boolean") throw new Error("bool");
          if (typeof c === "string") c = enteroEstricto(c);
          else if (typeof c === "number") { if (!Number.isInteger(c)) throw new Error("no entero"); }
          else throw new Error("tipo");
          if (c <= 0 || c > cfg.cantidad_max_cajas_por_linea) throw new Error("rango");
        } catch (x) {
          err.push(["INVALIDO", "lineas[" + i + "].cajas", "Línea " + i + " (" + pid + "): las cajas deben ser un entero entre 1 y " + cfg.cantidad_max_cajas_por_linea + "."]);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(vistos, pid)) {
          err.push(["INVALIDO", "lineas[" + i + "].id_producto", "Producto " + pid + " repetido: agrupe las cajas en una sola línea."]);
          return;
        }
        vistos[pid] = true;
        lineas.push({ id_producto: pid, cajas: c });
      });
    }
    n.lineas = lineas;

    // descuento
    var d = e.descuento_pct;
    if (vacio(d)) { d = 0; adv.push("No se informó el descuento: se asumió 0 %."); }
    try {
      if (typeof d === "boolean") throw new Error("bool");
      var dd;
      if (typeof d === "number") dd = d;
      else if (typeof d === "string" && RE_NUM.test(d.trim())) dd = parseFloat(d.trim());
      else throw new Error("no numérico");
      if (!isFinite(dd) || dd < 0 || dd > 100) throw new Error("rango");
      n.descuento_bp = pctABp(d);
    } catch (x) {
      err.push(["INVALIDO", "descuento_pct", "El descuento debe ser un número entre 0 y 100."]);
      n.descuento_bp = 0;
    }

    n.ap_desc = vacio(apr.descuento) ? null : cadena(apr.descuento);
    n.ap_cred = vacio(apr.credito) ? null : cadena(apr.credito);
    n.id_solicitud = vacio(sol.id) ? null : cadena(sol.id);
    return { n: n, err: err, adv: adv };
  }

  // ----------------------------------------------------------- aprobaciones
  function buscarAprobacion(idAp, datos, estado) {
    var todas = datos.aprobaciones.concat(estado.aprobaciones);
    for (var i = 0; i < todas.length; i++) if (todas[i].id_aprobacion === idAp) return todas[i];
    return null;
  }

  function validarAprobacion(idAp, tipo, rol, aplicaA, requerido, fecha, datos, estado) {
    if (!idAp) return { ok: false, codigo: "FALTA", detalle: "No se informó un ID de aprobación.", registro: null };
    var r = buscarAprobacion(idAp, datos, estado);
    if (r === null) return { ok: false, codigo: "NO_ENCONTRADA", detalle: "La aprobación " + idAp + " no existe en el registro.", registro: null };
    if (r.tipo !== tipo) return { ok: false, codigo: "TIPO_INCORRECTO", detalle: "La aprobación " + idAp + " es de tipo " + r.tipo + ", no " + tipo + ".", registro: r };
    if (r.rol !== rol) return { ok: false, codigo: "ROL_INCORRECTO", detalle: "La aprobación " + idAp + " la emitió " + r.rol + ", no " + rol + ".", registro: r };
    if (r.aplica_a !== aplicaA) return { ok: false, codigo: "NO_APLICA", detalle: "La aprobación " + idAp + " aplica a " + r.aplica_a + ", no a " + aplicaA + " (la excepción no es permanente).", registro: r };
    if (r.valor_max < requerido) return { ok: false, codigo: "INSUFICIENTE", detalle: "La aprobación " + idAp + " no cubre el valor solicitado.", registro: r };
    if (r.vigente_hasta && fecha > r.vigente_hasta) return { ok: false, codigo: "VENCIDA", detalle: "La aprobación " + idAp + " venció el " + r.vigente_hasta + ".", registro: r };
    return { ok: true, codigo: "OK", detalle: "Aprobación " + idAp + " vigente y aplicable.", registro: r };
  }

  /** Simula la DECISIÓN HUMANA (Jefatura o Finanzas). El agente nunca llama esto solo. */
  function registrarAprobacion(estado, tipo, aplicaA, valor, aprobador, motivo) {
    tipo = String(tipo).toUpperCase();
    var v;
    try {
      if (typeof valor === "boolean" || vacio(valor)) throw new Error("x");
      v = decAEntero(valor, 2);
      if (v < 0) throw new Error("x");
    } catch (x) {
      throw new Error("el valor máximo aprobado debe ser un número mayor o igual a 0");
    }
    var idr, rol;
    if (tipo === "DESCUENTO") { estado.contadores.AUT += 1; idr = "AUT-SIM-" + ("00" + estado.contadores.AUT).slice(-3); rol = "JEFATURA_COMERCIAL"; }
    else if (tipo === "CREDITO") { estado.contadores.APR += 1; idr = "APR-SIM-" + ("00" + estado.contadores.APR).slice(-3); rol = "FINANZAS"; }
    else throw new Error("tipo de aprobación no válido");
    var reg = {
      id_aprobacion: idr, tipo: tipo, rol: rol, aplica_a: aplicaA, valor_max: v, vigente_hasta: null,
      motivo: motivo || "Decisión humana simulada en la demostración",
      origen: "DECISIÓN HUMANA SIMULADA (" + (aprobador || "sin nombre") + ")"
    };
    estado.aprobaciones.push(reg);
    return reg;
  }

  // ------------------------------------------------------------- cotización
  function maxBpMargen(precio, costo, mmin) {
    function ok(bp) {
      var neto = rhu(precio * (10000 - bp), 10000);
      return neto > 0 && (neto - costo) * 10000 >= mmin * neto;
    }
    if (!ok(0)) return null;
    var lo = 0, hi = 10000;
    while (lo < hi) {
      var mid = floorDiv(lo + hi + 1, 2);
      if (ok(mid)) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function cotizarNucleo(n, datos, cfg, estado, fechaAprob) {
    var bp = n.descuento_bp;
    var ejBp = pctABp(cfg.tramos_descuento.ejecutivo_max_pct);
    var jeBp = pctABp(cfg.tramos_descuento.jefatura_max_pct);
    var cli = n.id_cliente && datos.clientes[n.id_cliente] ? datos.clientes[n.id_cliente] : null;
    var lineas = [], bloqueos = [];
    var tLista = 0, tSub = 0, tCosto = 0, verificable = true, volumen = 0;
    n.lineas.forEach(function (ln) {
      var p = datos.productos[ln.id_producto] || null;
      if (p === null) {
        bloqueos.push({ causa: "PRODUCTO_NO_ENCONTRADO", detalle: "El producto " + ln.id_producto + " no existe en la tabla de productos." });
        verificable = false;
        return;
      }
      var precio = p.precio_cents;
      var neto = rhu(precio * (10000 - bp), 10000);
      var bruto = ln.cajas * precio, sub = ln.cajas * neto;
      volumen += ln.cajas;
      var l = {
        id_producto: p.id_producto, nombre: p.nombre, cajas: ln.cajas, precio_lista: m(precio), precio_neto: m(neto), bruto: m(bruto),
        descuento_monto: m(bruto - sub), subtotal: m(sub), costo_total: null, margen_pct: null, margen_min_pct: bpAPct(p.margen_min_bp),
        cumple_margen: null, max_descuento_pct: null
      };
      tLista += bruto; tSub += sub;
      if (p.costo_cents === null || p.margen_min_bp === null) {
        verificable = false;
        bloqueos.push({ causa: "SIN_COSTO_O_MARGEN", detalle: "El producto " + p.id_producto + " no tiene costo o margen mínimo en la tabla: no se puede verificar el margen." });
      } else {
        var costoT = ln.cajas * p.costo_cents;
        tCosto += costoT;
        l.costo_total = m(costoT);
        if (sub > 0) {
          l.margen_pct = bpAPct(rhu((sub - costoT) * 10000, sub));
          l.cumple_margen = (sub - costoT) * 10000 >= p.margen_min_bp * sub;
        } else l.cumple_margen = false;
        var mx = maxBpMargen(precio, p.costo_cents, p.margen_min_bp);
        l.max_descuento_pct = mx === null ? null : bpAPct(mx);
        if (!l.cumple_margen) {
          bloqueos.push({
            causa: "MARGEN_BAJO_MINIMO",
            detalle: p.nombre + ": margen " + f2(l.margen_pct !== null ? l.margen_pct : 0) + " % < mínimo " + f2(bpAPct(p.margen_min_bp)) + " %. " +
              (mx !== null ? "Descuento máximo que respeta el margen: " + f2(l.max_descuento_pct) + " %." : "Ni sin descuento se alcanza el margen mínimo: revisar precio o costo.")
          });
        }
      }
      lineas.push(l);
    });
    var igv = rhu(tSub * cfg.igv_pct, 100);
    var total = tSub + igv;
    var tot = { lista: m(tLista), descuento: m(tLista - tSub), subtotal: m(tSub), igv: m(igv), total: m(total),
                costo: verificable ? m(tCosto) : null, utilidad: null, margen_pct: null, cajas: volumen };
    if (verificable && tSub > 0) {
      tot.utilidad = m(tSub - tCosto);
      tot.margen_pct = bpAPct(rhu((tSub - tCosto) * 10000, tSub));
    }

    var nivel = bp <= ejBp ? "EJECUTIVO" : (bp <= jeBp ? "JEFATURA" : "FUERA_POLITICA");
    var aut = { nivel_requerido: nivel, descuento_pct: bpAPct(bp), id_aprobacion: null, detalle: "", codigo: null };
    var ejMax = cfg.tramos_descuento.ejecutivo_max_pct, jeMax = cfg.tramos_descuento.jefatura_max_pct;
    if (nivel === "EJECUTIVO") {
      aut.estado = "AUTORIZADA_EJECUTIVO";
      aut.detalle = "Descuento dentro de la facultad del ejecutivo (hasta " + ejMax + " %).";
    } else if (nivel === "FUERA_POLITICA") {
      aut.estado = "FUERA_DE_POLITICA";
      aut.detalle = "Descuento superior a " + jeMax + " %: fuera de la política; nadie puede autorizarlo.";
      bloqueos.unshift({ causa: "DESCUENTO_FUERA_DE_POLITICA", detalle: aut.detalle + " Reduzca el descuento y reenvíe." });
    } else {
      var v = validarAprobacion(n.ap_desc, "DESCUENTO", "JEFATURA_COMERCIAL", n.etiqueta, bp, fechaAprob, datos, estado);
      aut.codigo = v.codigo;
      if (v.ok) {
        aut.estado = "APROBADA_JEFATURA";
        aut.id_aprobacion = n.ap_desc;
        aut.detalle = "Aprobado por la Jefatura Comercial (" + n.ap_desc + "), solo para " + n.etiqueta + ".";
      } else {
        aut.estado = "REQUIERE_APROBACION_JEFATURA";
        aut.detalle = "Descuento mayor a " + ejMax + " % y hasta " + jeMax + " %: lo decide la Jefatura Comercial. " + v.detalle;
      }
    }

    var ficha = null;
    if (nivel === "JEFATURA") {
      var umbral = cfg.umbral_volumen_cajas;
      var disp = cli ? cli.linea_cents - cli.deuda_cents : null;
      ficha = {
        canal: cli ? cli.canal : null, volumen_cajas: volumen, umbral_volumen: umbral, cumple_volumen: volumen >= umbral,
        margenes_ok: lineas.every(function (x) { return x.cumple_margen === true; }) && verificable,
        compras_previas: cli ? cli.compras_previas : null, riesgo_cliente_nuevo: !!(cli && cli.compras_previas === 0),
        credito_disponible: m(disp), total_con_igv: m(total), credito_alcanza: (disp !== null && disp >= total)
      };
      var partes = [];
      partes.push("volumen " + volumen + " cajas " + (ficha.cumple_volumen ? "≥" : "<") + " umbral " + umbral);
      partes.push("márgenes " + (ficha.margenes_ok ? "sobre" : "NO alcanzan") + " el mínimo");
      if (ficha.riesgo_cliente_nuevo) partes.push("cliente sin compras previas (requiere validación financiera)");
      partes.push("crédito " + (ficha.credito_alcanza ? "alcanza" : "NO alcanza"));
      ficha.resumen = "Evidencia para la Jefatura: " + partes.join("; ") + ". El agente solo informa; decide la Jefatura.";
    }

    return {
      cot: {
        etiqueta: n.etiqueta, id: n.cot_id, version: n.cot_version, cliente: n.id_cliente, fecha_emision: n.fecha_emision,
        vigencia_hasta: n.vigencia_hasta, descuento_pct: bpAPct(bp), lineas: lineas, totales: tot, autorizacion: aut,
        ficha_jefatura: ficha, bloqueos: bloqueos, margenes_verificables: verificable
      },
      cli: cli
    };
  }

  // ------------------------------------------------------------------ stock
  function calcularStock(n, datos, estado, fechaRef) {
    var set = {}; datos.stock.forEach(function (r) { set[r.fecha_corte] = true; });
    var cortes = Object.keys(set).sort();
    var adv = [], corte;
    var previos = cortes.filter(function (c) { return c <= fechaRef; });
    if (previos.length) corte = previos[previos.length - 1];
    else if (cortes.length) {
      corte = cortes[0];
      adv.push("No existe una foto de stock anterior a " + fechaRef + ": se usó la más antigua (" + corte + ").");
    } else corte = null;
    var filas = datos.stock.filter(function (r) { return r.fecha_corte === corte; });
    var reservado = {};
    estado.reservas.forEach(function (rv) { reservado[rv.id_lote] = (reservado[rv.id_lote] || 0) + rv.cajas; });
    var comprometido = {}; // reposiciones ya prometidas a otros clientes en esta sesión (no se prometen dos veces)
    (estado.promesas || []).forEach(function (pr) { comprometido[pr.clave] = (comprometido[pr.clave] || 0) + pr.cajas; });
    var lineas = [];
    n.lineas.forEach(function (ln) {
      var p = datos.productos[ln.id_producto] || null;
      if (p === null) return;
      var lotes = filas.filter(function (r) { return r.id_producto === p.id_producto; });
      var aptos = [], noAptos = [];
      lotes.forEach(function (r) {
        var libre = r.cajas - (reservado[r.id_lote] || 0);
        var motivo = null, vidaRest = null;
        if (r.estado_calidad !== "LIBERADO") motivo = "No liberado por Calidad (" + r.estado_calidad + ")";
        else if (r.fecha_vencimiento) {
          var rem = dias(r.fecha_vencimiento, n.entrega_solicitada);
          if (p.vida_util_dias) vidaRest = pyRound(rem * 1000 / p.vida_util_dias) / 10.0;
          if (rem < 0) motivo = "Vencido a la fecha de entrega (" + r.fecha_vencimiento + ")";
          else if (p.vida_min_entrega_pct && p.vida_util_dias && rem * 100 < p.vida_min_entrega_pct * p.vida_util_dias)
            motivo = "Vida útil restante " + f1(vidaRest) + " % < " + p.vida_min_entrega_pct + " % exigido a la entrega";
        }
        if (libre <= 0 && motivo === null) motivo = "Sin cajas libres (reservadas en esta sesión)";
        var item = { id_lote: r.id_lote, cajas: r.cajas, libres: Math.max(libre, 0), estado_calidad: r.estado_calidad,
                     fecha_vencimiento: r.fecha_vencimiento, vida_util_restante_pct: vidaRest };
        if (motivo) { item.motivo = motivo; noAptos.push(item); } else aptos.push(item);
      });
      aptos.sort(function (a, b) { // FEFO: primero el que vence antes
        var ka = (a.fecha_vencimiento || "9999-12-31") + "\u0000" + a.id_lote, kb = (b.fecha_vencimiento || "9999-12-31") + "\u0000" + b.id_lote;
        return ka < kb ? -1 : (ka > kb ? 1 : 0);
      });
      var falta = ln.cajas, asign = [];
      aptos.forEach(function (a) {
        if (falta <= 0) return;
        var t = Math.min(a.libres, falta);
        if (t > 0) { asign.push({ id_lote: a.id_lote, cajas: t, fecha_vencimiento: a.fecha_vencimiento }); falta -= t; }
      });
      var dispTotal = aptos.reduce(function (s, a) { return s + a.libres; }, 0);
      var repos = [];
      lotes.forEach(function (r) {
        if (r.reposicion_cajas && r.reposicion_fecha) {
          var clave = r.reposicion_ref || r.id_lote, librer = r.reposicion_cajas - (comprometido[clave] || 0);
          if (librer > 0) repos.push({ fecha: r.reposicion_fecha, cajas: librer, ref: r.reposicion_ref, clave: clave });
        }
      });
      repos.sort(function (a, b) {
        var ka = a.fecha + "\u0000" + (a.ref || ""), kb = b.fecha + "\u0000" + (b.ref || "");
        return ka < kb ? -1 : (ka > kb ? 1 : 0);
      });
      lineas.push({ id_producto: p.id_producto, nombre: p.nombre, solicitadas: ln.cajas, disponibles: dispTotal,
                    faltante: Math.max(0, ln.cajas - dispTotal), asignacion: asign, lotes_aptos: aptos, lotes_no_aptos: noAptos, reposiciones: repos });
    });
    return { stock: { fecha_corte_usada: corte, fecha_entrega_evaluada: n.entrega_solicitada, lineas: lineas }, adv: adv };
  }

  function armarPromesa(stock, n) {
    var entrega = n.entrega_solicitada, fechas = {}, sinFecha = [], condicionada = false;
    stock.lineas.forEach(function (l) {
      var disp = Math.min(l.solicitadas, l.disponibles);
      if (disp > 0) (fechas[entrega] = fechas[entrega] || []).push({ id_producto: l.id_producto, nombre: l.nombre, cajas: disp, ref: null, condicionada: false });
      var falta = l.faltante;
      l.reposiciones.forEach(function (r) {
        if (falta <= 0) return;
        var t = Math.min(falta, r.cajas), cond = r.fecha <= entrega, f = cond ? entrega : r.fecha;
        condicionada = condicionada || cond;
        (fechas[f] = fechas[f] || []).push({ id_producto: l.id_producto, nombre: l.nombre, cajas: t, ref: r.ref, condicionada: true });
        falta -= t;
      });
      if (falta > 0) sinFecha.push({ id_producto: l.id_producto, nombre: l.nombre, cajas: falta });
    });
    var entregas = Object.keys(fechas).sort().map(function (f) {
      return { fecha: f, cajas: fechas[f].reduce(function (s, x) { return s + x.cajas; }, 0), detalle: fechas[f] };
    });
    var dispHoy = stock.lineas.reduce(function (s, l) { return s + Math.min(l.solicitadas, l.disponibles); }, 0);
    return { entregas: entregas, faltante_sin_fecha: sinFecha, disponible_ahora: dispHoy,
             total_solicitado: stock.lineas.reduce(function (s, l) { return s + l.solicitadas; }, 0),
             total_prometible: entregas.reduce(function (s, e) { return s + e.cajas; }, 0), condicionada_a_produccion: condicionada };
  }

  // ----------------------------------------------------------------- núcleo
  function ctl(id, nombre, resultado, detalle, responsable, evidencia) {
    return { id: id, nombre: nombre, resultado: resultado, detalle: detalle, responsable: responsable, evidencia: evidencia };
  }
  function idPedido(idSol, cfg) {
    if (idSol.indexOf(cfg.prefijo_solicitud) === 0) return cfg.prefijo_pedido + idSol.slice(cfg.prefijo_solicitud.length);
    return cfg.prefijo_pedido + idSol;
  }
  function errores(err) { return err.map(function (x) { return { tipo: x[0], campo: x[1], mensaje: x[2] }; }); }
  var MOTOR = { nombre: "javascript", version: VERSION_MOTOR };

  /** Paso A: calcula la cotización y dice quién debe autorizarla. */
  function cotizar(entrada, datos, cfg, estado, hoy) {
    estado = estado || nuevoEstado();
    hoy = hoy || hoyIso();
    var r = normalizar(entrada, cfg, hoy, "cotizar"), n = r.n, err = r.err;
    var eventos = [];
    var out = { motor: MOTOR, modo: "cotizar", advertencias: r.adv, errores: [], cotizacion: null, eventos: eventos };
    if (err.length) {
      out.errores = errores(err);
      eventos.push({ paso: "COTIZAR", control: "Datos", resultado: "NO_CUMPLE", detalle: err.map(function (x) { return x[2]; }).join("; "), responsable: cfg.roles.ejecutivo });
      return out;
    }
    var q = cotizarNucleo(n, datos, cfg, estado, n.fecha_emision), cot = q.cot;
    if (q.cli === null) cot.bloqueos.unshift({ causa: "CLIENTE_NO_ENCONTRADO", detalle: "El cliente " + n.id_cliente + " no existe en la tabla de clientes." });
    out.cotizacion = cot;
    var okAut = cot.bloqueos.length === 0 && (cot.autorizacion.estado === "AUTORIZADA_EJECUTIVO" || cot.autorizacion.estado === "APROBADA_JEFATURA");
    eventos.push({ paso: "COTIZAR", control: "Descuento y margen", resultado: okAut ? "CUMPLE" : "NO_CUMPLE",
                   detalle: cot.etiqueta + ": " + cot.autorizacion.estado + " | subtotal " + f2(cot.totales.subtotal) + " | total " + f2(cot.totales.total),
                   responsable: cfg.roles.ejecutivo });
    return out;
  }

  /** Paso B: evento SOLICITAR_CREACION_PEDIDO -> controles del ERP -> respuesta. */
  function solicitarPedido(entrada, datos, cfg, estado, hoy) {
    estado = estado || nuevoEstado();
    hoy = hoy || hoyIso();
    var roles = cfg.roles;
    var nr = normalizar(entrada, cfg, hoy, "solicitar"), n = nr.n, err = nr.err, adv = nr.adv;
    if (!n.id_solicitud) {
      estado.contadores.SOL += 1;
      n.id_solicitud = cfg.prefijo_solicitud + "AUTO-" + ("00" + estado.contadores.SOL).slice(-3);
      adv.push("No se informó el ID de la solicitud: el agente asignó " + n.id_solicitud + ".");
    }
    var fechaLimite = sumaDias(n.fecha_solicitud, cfg.dias_fecha_limite_respuesta);
    var ctrls = [], eventos = [], pendientes = [];
    function ev(paso, control, res, det, resp) { eventos.push({ paso: paso, control: control, resultado: res, detalle: det, responsable: resp }); }

    var res = {
      motor: MOTOR, modo: "solicitar", id_solicitud: n.id_solicitud, etiqueta_cotizacion: n.etiqueta, evento_entrada: "SOLICITAR_CREACION_PEDIDO",
      advertencias: adv, errores: [], controles: ctrls, cotizacion: null, stock: null, promesa: null, credito: null, id_pedido: null,
      pendientes: pendientes, causas_adicionales: [], fecha_limite: fechaLimite, eventos: eventos
    };
    ev("RECEPCION", "SOLICITAR_CREACION_PEDIDO", "INFO", "Solicitud " + n.id_solicitud + " recibida del CRM (estado: Enviada → En validación).", roles.ejecutivo);

    function cerrar(respuesta, causa, mensaje, responsable, siguiente, estadoSol, extraCausas) {
      res.respuesta = respuesta; res.causa = causa; res.mensaje = mensaje;
      res.responsable = responsable; res.siguiente_accion = siguiente; res.estado_solicitud = estadoSol;
      res.evento_respuesta = respuesta === "PROMESA_ALTERNATIVA" ? "CONFIRMAR_PROMESA" : "ACEPTAR_O_RECHAZAR_PEDIDO";
      if (extraCausas && extraCausas.length) res.causas_adicionales = extraCausas;
      res.mensaje_entrada = {
        evento: "SOLICITAR_CREACION_PEDIDO",
        identidad: { cliente: n.id_cliente },
        oferta: { id_cotizacion: n.cot_id, version: n.cot_version, descuento_pct: bpAPct(n.descuento_bp), moneda: cfg.moneda, vigencia_hasta: n.vigencia_hasta,
                  lineas: n.lineas.map(function (l) { return { producto: l.id_producto, cajas: l.cajas }; }) },
        promesa_solicitada: { fecha: n.entrega_solicitada, modalidad: n.modalidad },
        trazabilidad: { id_solicitud: n.id_solicitud, fecha_solicitud: n.fecha_solicitud },
        gobierno: { id_aprobacion_descuento: n.ap_desc, id_aprobacion_credito: n.ap_cred }
      };
      res.mensaje_respuesta = {
        evento: res.evento_respuesta, id_solicitud: n.id_solicitud, respuesta: respuesta, id_pedido: res.id_pedido, causa: causa,
        estado: estadoSol, objeto_afectado: n.etiqueta, responsable: responsable, fecha_limite: fechaLimite
      };
      ev("RESPUESTA", res.evento_respuesta, respuesta, causa + " — " + mensaje, responsable);
      return res;
    }
    var NOMBRES_RESTO = [["C1", "Cliente habilitado y cotización vigente"], ["C2", "Descuento y margen"], ["C3", "Crédito"], ["C4", "Disponibilidad"]];

    // ---- Control 0: datos mínimos, formato y duplicidad
    if (err.length) {
      res.errores = errores(err);
      var faltan = err.some(function (x) { return x[0] === "FALTANTE"; });
      var det = err.map(function (x) { return x[2]; }).join(" | ");
      ctrls.push(ctl("C0", "Datos mínimos y trazabilidad", "NO_CUMPLE", det, roles.ejecutivo, "Contrato CRM–ERP (EP, sec. 4): sin identificadores la solicitud no se envía"));
      NOMBRES_RESTO.forEach(function (x) { ctrls.push(ctl(x[0], x[1], "NO_EVALUADO", "No se evalúa: los datos mínimos están incompletos o son inválidos.", "", "")); });
      ev("C0", "Datos mínimos", "NO_CUMPLE", det, roles.ejecutivo);
      pendientes.push({ rol: roles.ejecutivo, accion: "Corregir y reenviar la solicitud", detalle: det });
      return cerrar("RECHAZO_VALIDABLE", faltan ? "DATOS_INCOMPLETOS" : "DATO_INVALIDO", "Faltan o son inválidos datos de la solicitud: " + det,
                    roles.ejecutivo, "El CRM corrige los datos y reenvía con el mismo flujo.", "RECHAZADA_VALIDABLE");
    }
    if (cfg.bloquear_duplicados !== false) {
      var previo = null;
      for (var i = 0; i < estado.pedidos.length; i++) {
        var pp = estado.pedidos[i];
        if (pp.id_solicitud === n.id_solicitud || pp.etiqueta === n.etiqueta) { previo = pp; break; }
      }
      if (previo) {
        var detD = "La solicitud/cotización ya generó el pedido " + previo.id_pedido + " (" + previo.id_solicitud + "). No se crea un segundo pedido.";
        ctrls.push(ctl("C0", "Datos mínimos y trazabilidad", "NO_CUMPLE", detD, roles.ti, "EP: no se duplican solicitudes; ID único"));
        NOMBRES_RESTO.forEach(function (x) { ctrls.push(ctl(x[0], x[1], "NO_EVALUADO", "No se evalúa: solicitud duplicada.", "", "")); });
        ev("C0", "No duplicidad", "NO_CUMPLE", detD, roles.ti);
        res.id_pedido = previo.id_pedido;
        pendientes.push({ rol: roles.ti, accion: "Verificar el reenvío", detalle: detD });
        return cerrar("RECHAZO_VALIDABLE", "SOLICITUD_DUPLICADA", detD, roles.ti,
                      "No hacer nada: el pedido original sigue vigente. Si fue un error de integración, TI revisa los reintentos.", "RECHAZADA_VALIDABLE");
      }
    }
    ctrls.push(ctl("C0", "Datos mínimos y trazabilidad", "CUMPLE", "Identidad, oferta, promesa solicitada y trazabilidad completos; ID " + n.id_solicitud + " único.", roles.ejecutivo, "EP sec. 4: cinco grupos de datos mínimos"));
    ev("C0", "Datos mínimos", "CUMPLE", "Solicitud " + n.id_solicitud + " con datos completos y no duplicada.", roles.ejecutivo);

    var q = cotizarNucleo(n, datos, cfg, estado, n.fecha_solicitud), cot = q.cot, cli = q.cli;
    res.cotizacion = cot;
    var rechazos = [], atencion = [], aprobs = [];

    // ---- Control 1: cliente habilitado y cotización vigente/aceptada
    var problemas1 = [];
    if (cli === null) {
      rechazos.push(["CLIENTE_NO_ENCONTRADO", "El cliente " + n.id_cliente + " no existe en la tabla de clientes.", roles.ejecutivo]);
      problemas1.push(rechazos[rechazos.length - 1][1]);
    } else if (!cli.habilitado) {
      atencion.push(["CLIENTE_NO_HABILITADO", "El cliente " + cli.id_cliente + " (" + cli.nombre_comercial + ") está como prospecto en el CRM pero NO está habilitado en el ERP: requiere alta en datos maestros.", roles.datos_maestros]);
      problemas1.push(atencion[atencion.length - 1][1]);
    }
    if (!n.aceptada) {
      rechazos.push(["COTIZACION_NO_ACEPTADA", "La cotización " + n.etiqueta + " no figura como aceptada por el cliente: aún no hay solicitud de pedido.", roles.ejecutivo]);
      problemas1.push(rechazos[rechazos.length - 1][1]);
    } else {
      if (n.fecha_aceptacion && n.fecha_aceptacion > n.vigencia_hasta) {
        rechazos.push(["COTIZACION_VENCIDA", "La aceptación (" + n.fecha_aceptacion + ") ocurrió después de la vigencia (" + n.vigencia_hasta + ").", roles.ejecutivo]);
        problemas1.push(rechazos[rechazos.length - 1][1]);
      } else if (n.fecha_solicitud > n.vigencia_hasta) {
        rechazos.push(["COTIZACION_VENCIDA", "La cotización " + n.etiqueta + " venció el " + n.vigencia_hasta + " y la solicitud es del " + n.fecha_solicitud + ": emitir una nueva versión.", roles.ejecutivo]);
        problemas1.push(rechazos[rechazos.length - 1][1]);
      }
      if (n.fecha_aceptacion && n.fecha_solicitud < n.fecha_aceptacion) {
        rechazos.push(["DATO_INVALIDO", "La solicitud (" + n.fecha_solicitud + ") es anterior a la aceptación (" + n.fecha_aceptacion + ").", roles.ejecutivo]);
        problemas1.push(rechazos[rechazos.length - 1][1]);
      }
    }
    if (problemas1.length) {
      ctrls.push(ctl("C1", "Cliente habilitado y cotización vigente", "NO_CUMPLE", problemas1.join(" | "),
                     cli && !cli.habilitado ? roles.datos_maestros : roles.ejecutivo, "EP sec. 4, control 1; PC2 sec. 2.2 (el cliente activo lo valida el ERP)"));
      ev("C1", "Cliente y cotización", "NO_CUMPLE", problemas1.join(" | "), roles.ejecutivo);
    } else {
      var d1 = "Cliente " + cli.id_cliente + " habilitado; " + n.etiqueta + " aceptada el " + n.fecha_aceptacion + " y vigente hasta " + n.vigencia_hasta + " (solicitud del " + n.fecha_solicitud + ").";
      ctrls.push(ctl("C1", "Cliente habilitado y cotización vigente", "CUMPLE", d1, roles.ejecutivo, "EP sec. 4, control 1; Excel: hoja Clientes y Cotizaciones"));
      ev("C1", "Cliente y cotización", "CUMPLE", d1, roles.ejecutivo);
    }

    // ---- Control 2: descuento y margen
    var aut = cot.autorizacion;
    var CAUSAS_C2 = ["PRODUCTO_NO_ENCONTRADO", "SIN_COSTO_O_MARGEN", "MARGEN_BAJO_MINIMO", "DESCUENTO_FUERA_DE_POLITICA"];
    var c2Bloq = cot.bloqueos.filter(function (b) { return CAUSAS_C2.indexOf(b.causa) >= 0; });
    c2Bloq.forEach(function (b) { rechazos.push([b.causa, b.detalle, roles.ejecutivo]); });
    var pcts = function () { return cot.lineas.map(function (l) { return f2(l.margen_pct) + " %"; }).join(", "); };
    if (c2Bloq.length) {
      var d2 = c2Bloq.map(function (b) { return b.detalle; }).join(" | ");
      ctrls.push(ctl("C2", "Descuento y margen", "NO_CUMPLE", d2, roles.ejecutivo, "PC2 sec. 2.5: tramos de descuento y márgenes mínimos (15 % UHT/evaporada, 25 % fresca)"));
      ev("C2", "Descuento y margen", "NO_CUMPLE", d2, roles.ejecutivo);
    } else if (aut.estado === "REQUIERE_APROBACION_JEFATURA") {
      var cod = aut.codigo || "FALTA";
      var causa2 = (cod === "FALTA" || cod === "NO_ENCONTRADA") ? "DESCUENTO_REQUIERE_JEFATURA" : "APROBACION_DESCUENTO_INVALIDA";
      aprobs.push([causa2, aut.detalle, roles.jefatura]);
      ctrls.push(ctl("C2", "Descuento y margen", "NO_CUMPLE",
                     aut.detalle + " Márgenes sobre el mínimo en todas las líneas: " + (cot.lineas.every(function (l) { return l.cumple_margen; }) ? "sí" : "no") + ".",
                     roles.jefatura, "PC2 sec. 3.1: descuento excepcional lo decide la Jefatura con evidencia"));
      ev("C2", "Descuento y margen", "NO_CUMPLE", "Descuento " + f2(aut.descuento_pct) + " % sin aprobación válida de Jefatura (" + cod + ").", roles.jefatura);
      pendientes.push({ rol: roles.jefatura, accion: "Decidir el descuento excepcional de " + f2(aut.descuento_pct) + " % para " + n.etiqueta,
                        detalle: cot.ficha_jefatura ? cot.ficha_jefatura.resumen : "" });
    } else {
      var d2b;
      if (aut.estado === "APROBADA_JEFATURA") d2b = f2(aut.descuento_pct) + " % aprobado por Jefatura (" + aut.id_aprobacion + "); márgenes " + pcts() + "; mínimo cumplido en todas las líneas.";
      else d2b = f2(aut.descuento_pct) + " % dentro de la facultad del ejecutivo; márgenes " + pcts() + " sobre el mínimo.";
      var rolC2 = aut.estado === "APROBADA_JEFATURA" ? roles.jefatura : roles.ejecutivo;
      ctrls.push(ctl("C2", "Descuento y margen", "CUMPLE", d2b, rolC2, "PC2 sec. 2.5 y 3.1; Excel: hojas Reglas_descuento y Cot_Detalle"));
      ev("C2", "Descuento y margen", "CUMPLE", d2b, rolC2);
    }

    // ---- Control 3: crédito
    var prodOk = !cot.bloqueos.some(function (b) { return b.causa === "PRODUCTO_NO_ENCONTRADO"; });
    if (cli === null || !prodOk) {
      ctrls.push(ctl("C3", "Crédito suficiente", "NO_EVALUADO", "No se evalúa: falta el cliente o hay productos inválidos.", "", ""));
    } else {
      var totalC = cents(cot.totales.total);
      var dispC = cli.linea_cents - cli.deuda_cents;
      var saldo = dispC - totalC;
      res.credito = { linea: m(cli.linea_cents), deuda_vigente: m(cli.deuda_cents), disponible: m(dispC), total_con_igv: m(totalC), saldo: m(saldo), plazo_dias: cli.plazo_dias };
      if (saldo >= 0) {
        var d3 = "S/ " + f2(m(totalC)) + " frente a línea disponible S/ " + f2(m(dispC)) + " (línea S/ " + f2(m(cli.linea_cents)) + ", deuda S/ " + f2(m(cli.deuda_cents)) + "): saldo S/ " + f2(m(saldo)) + ".";
        ctrls.push(ctl("C3", "Crédito suficiente", "CUMPLE", d3, roles.finanzas, "EP sec. 4, control 3; Excel: hoja Clientes"));
        ev("C3", "Crédito", "CUMPLE", d3, roles.finanzas);
      } else {
        var vc = validarAprobacion(n.ap_cred, "CREDITO", "FINANZAS", n.etiqueta, totalC, n.fecha_solicitud, datos, estado);
        if (vc.ok) {
          var d3a = "Total S/ " + f2(m(totalC)) + " excede la línea disponible S/ " + f2(m(dispC)) + " por S/ " + f2(m(-saldo)) + ", pero Finanzas lo aprobó (" + n.ap_cred + ").";
          ctrls.push(ctl("C3", "Crédito suficiente", "ALERTA", d3a, roles.finanzas, "Aprobación humana de Finanzas registrada"));
          ev("C3", "Crédito", "ALERTA", d3a, roles.finanzas);
        } else {
          var d3b = "Total S/ " + f2(m(totalC)) + " excede la línea disponible S/ " + f2(m(dispC)) + " por S/ " + f2(m(-saldo)) + ". " + (n.ap_cred ? vc.detalle : "Requiere decisión de Finanzas.");
          var causa3 = (vc.codigo === "FALTA" || vc.codigo === "NO_ENCONTRADA") ? "CREDITO_INSUFICIENTE" : "APROBACION_CREDITO_INVALIDA";
          aprobs.push([causa3, d3b, roles.finanzas]);
          ctrls.push(ctl("C3", "Crédito suficiente", "NO_CUMPLE", d3b, roles.finanzas, "EP sec. 4, control 3: el ERP compara el monto con el límite del cliente; valida Finanzas"));
          ev("C3", "Crédito", "NO_CUMPLE", d3b, roles.finanzas);
          pendientes.push({ rol: roles.finanzas, accion: "Decidir sobre el exceso de crédito de S/ " + f2(m(-saldo)) + " en " + n.etiqueta, detalle: d3b });
        }
      }
    }

    // ---- Control 4: disponibilidad
    var stock = null;
    if (!prodOk || !n.lineas.length) {
      ctrls.push(ctl("C4", "Disponibilidad (stock liberado por Calidad)", "NO_EVALUADO", "No se evalúa: hay productos inválidos.", "", ""));
    } else {
      var sr = calcularStock(n, datos, estado, n.fecha_solicitud);
      stock = sr.stock;
      res.advertencias = res.advertencias.concat(sr.adv);
      res.stock = stock;
      var faltantes = stock.lineas.filter(function (l) { return l.faltante > 0; });
      if (!faltantes.length) {
        var d4 = "Foto de stock " + stock.fecha_corte_usada + ": " + stock.lineas.map(function (l) { return l.nombre + " " + (l.disponibles < l.solicitadas ? l.disponibles : l.solicitadas) + "/" + l.solicitadas + " cajas"; }).join("; ") + ". Lotes liberados por Calidad y con vida útil suficiente (FEFO).";
        ctrls.push(ctl("C4", "Disponibilidad (stock liberado por Calidad)", "CUMPLE", d4, roles.almacen, "EP sec. 4, control 4; tabla stock_lotes.csv"));
        ev("C4", "Disponibilidad", "CUMPLE", d4, roles.almacen);
      } else {
        var prom = armarPromesa(stock, n);
        res.promesa = prom;
        var d4b = "Foto de stock " + stock.fecha_corte_usada + ": faltante en " + faltantes.map(function (l) { return l.nombre + ": solicitadas " + l.solicitadas + ", disponibles " + l.disponibles + ", faltan " + l.faltante; }).join("; ") + ".";
        ctrls.push(ctl("C4", "Disponibilidad (stock liberado por Calidad)", "NO_CUMPLE", d4b, roles.almacen, "EP sec. 5: el ERP no acepta el pedido completo ni inventa una fecha"));
        ev("C4", "Disponibilidad", "NO_CUMPLE", d4b, roles.almacen);
        if (prom.faltante_sin_fecha.length) {
          pendientes.push({ rol: roles.planeamiento, accion: "Sustentar una fecha para el faltante",
                            detalle: "Sin reposición programada para: " + prom.faltante_sin_fecha.map(function (x) { return x.nombre + " (" + x.cajas + " cajas)"; }).join(", ") });
        } else {
          var det4 = [];
          prom.entregas.forEach(function (e) { e.detalle.forEach(function (d) { if (d.ref) det4.push(d.nombre + ": " + d.cajas + " cajas el " + e.fecha + " (" + d.ref + ")"); }); });
          pendientes.push({ rol: roles.planeamiento, accion: "Validar la fecha de la producción programada", detalle: det4.join("; ") });
          pendientes.push({ rol: roles.ejecutivo, accion: "Proponer la entrega en dos momentos al cliente y registrar su respuesta", detalle: "Mientras no acepte, la alternativa no es un compromiso." });
        }
      }
    }

    // ---- Decisión final (prioridad: rechazo > atención > aprobación > faltante)
    var todas = rechazos.concat(atencion, aprobs);
    function otras(c) { return todas.filter(function (x) { return x[0] !== c; }).map(function (x) { return x[0]; }); }
    if (rechazos.length) {
      var r0 = rechazos[0];
      return cerrar("RECHAZO_VALIDABLE", r0[0], r0[1], r0[2], "El CRM corrige lo indicado y reenvía la solicitud.", "RECHAZADA_VALIDABLE", otras(r0[0]));
    }
    if (atencion.length) {
      var a0 = atencion[0];
      pendientes.push({ rol: a0[2], accion: "Habilitar al cliente en el ERP (alta de datos maestros)", detalle: a0[1] });
      return cerrar("CASO_ATENCION", a0[0], a0[1], a0[2], "Abrir un caso de atención: el CRM no puede resolverlo.", "EN_GESTION", otras(a0[0]));
    }
    if (aprobs.length) {
      var p0 = aprobs[0];
      return cerrar("APROBACION_REQUERIDA", p0[0], p0[1], p0[2], "Un humano con autoridad decide; luego se reenvía con el ID de aprobación.", "PENDIENTE_APROBACION", otras(p0[0]));
    }
    if (stock && res.promesa) {
      var pr = res.promesa;
      if (pr.faltante_sin_fecha.length) {
        var msg = "Hay faltante sin fecha sustentada: " + pr.faltante_sin_fecha.map(function (x) { return x.nombre + " (" + x.cajas + " cajas)"; }).join(", ") +
          ". El agente no promete lo que no puede respaldar. Disponible hoy: " + pr.disponible_ahora + " de " + pr.total_solicitado + " cajas (solo informativo, no es compromiso).";
        return cerrar("CASO_ATENCION", "FALTANTE_SIN_FECHA_SUSTENTADA", msg, roles.planeamiento, "Planeamiento revisa abastecimiento; si sustenta una fecha, se reenvía.", "EN_GESTION");
      }
      var partes = pr.entregas.map(function (e) { return e.cajas + " cajas el " + e.fecha; });
      var msg2 = "No hay stock liberado para entregar todo en " + n.entrega_solicitada + ". Alternativa sustentada: " + partes.join(" + ") + ". No se genera pedido hasta que el cliente acepte.";
      return cerrar("PROMESA_ALTERNATIVA", "FALTANTE_CON_REPOSICION", msg2, roles.planeamiento,
                    "Planeamiento valida la fecha; Ventas propone la alternativa al cliente. Sin aceptación no hay compromiso.", "PENDIENTE_ACEPTACION_CLIENTE");
    }

    // ---- Aceptada
    var idp = idPedido(n.id_solicitud, cfg);
    res.id_pedido = idp;
    estado.pedidos.push({ id_solicitud: n.id_solicitud, etiqueta: n.etiqueta, id_pedido: idp, cliente: n.id_cliente, total: cot.totales.total });
    var totalReserva = 0, listaLotes = [];
    stock.lineas.forEach(function (l) {
      l.asignacion.forEach(function (a) {
        estado.reservas.push({ id_pedido: idp, id_lote: a.id_lote, cajas: a.cajas });
        totalReserva += a.cajas; listaLotes.push(a.id_lote + "×" + a.cajas);
      });
    });
    ev("RESERVA", "Reserva de stock (sesión)", "INFO", "Se reservan " + totalReserva + " cajas en lotes: " + listaLotes.join(", ") + ".", roles.almacen);
    return cerrar("ACEPTADA", "CONTROLES_CUMPLIDOS",
                  "Los cuatro controles se cumplen. Pedido " + idp + " creado (ID simulado) para " + cot.totales.cajas + " cajas, total S/ " + f2(cot.totales.total) + " con IGV.",
                  "ERP", "Continuar con reserva, entrega y facturación (fuera del alcance de la PC3).", "ACEPTADA");
  }


  function clonar(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  /** Simulacro SIN efectos: qué pasaría si el cliente aceptara ahora (no crea pedido, no reserva, no escribe estado). */
  function previsualizar(entrada, datos, cfg, estado, hoy) {
    estado = estado || nuevoEstado();
    hoy = hoy || hoyIso();
    var e = esObj(entrada) ? clonar(entrada) : {};
    var cot = esObj(e.cotizacion) ? e.cotizacion : {}, sol = esObj(e.solicitud) ? e.solicitud : {};
    e.cotizacion = cot; e.solicitud = sol;
    cot.aceptada = true;
    if (vacio(cot.fecha_aceptacion)) cot.fecha_aceptacion = !vacio(sol.fecha) ? sol.fecha : hoy;
    var res = solicitarPedido(e, datos, cfg, clonar(estado), hoy);
    res.modo = "previsualizar"; res.simulacro = true;
    return res;
  }

  /** Evento CONFIRMAR_PROMESA: el cliente acepta o rechaza la entrega en dos momentos propuesta por el agente. */
  function confirmarPromesa(entrada, datos, cfg, estado, hoy, acepta) {
    estado = estado || nuevoEstado();
    hoy = hoy || hoyIso();
    if (acepta === undefined) acepta = true;
    var roles = cfg.roles;
    var res = solicitarPedido(entrada, datos, cfg, estado, hoy);
    res.modo = "confirmar_promesa";
    if (res.respuesta !== "PROMESA_ALTERNATIVA") { res.promesa_confirmada = false; return res; }
    var prom = res.promesa, stock = res.stock, cot = res.cotizacion;
    if (!acepta) {
      res.promesa_confirmada = false; res.decision_cliente = "RECHAZA"; res.estado_solicitud = "CERRADA_SIN_PEDIDO";
      res.mensaje = "El cliente no aceptó la entrega en dos momentos: no se genera pedido ni se reserva stock.";
      res.siguiente_accion = "Ninguna: la solicitud queda cerrada. El cliente puede pedir otra cotización.";
      res.pendientes = [];
      res.mensaje_respuesta.estado = res.estado_solicitud;
      res.eventos.push({ paso: "RESPUESTA", control: "CONFIRMAR_PROMESA", resultado: "RECHAZADA", detalle: res.mensaje, responsable: roles.ejecutivo });
      return res;
    }
    var idp = idPedido(res.id_solicitud, cfg);
    estado.pedidos.push({ id_solicitud: res.id_solicitud, etiqueta: res.etiqueta_cotizacion, id_pedido: idp, cliente: cot.cliente, total: cot.totales.total, entregas: prom.entregas });
    var cajasRes = [];
    stock.lineas.forEach(function (l) {
      l.asignacion.forEach(function (a) { estado.reservas.push({ id_pedido: idp, id_lote: a.id_lote, cajas: a.cajas }); cajasRes.push(a.id_lote + "×" + a.cajas); });
    });
    var comprometidas = [];
    prom.entregas.forEach(function (e) {
      e.detalle.forEach(function (d) {
        if (!d.condicionada) return;
        var lin = stock.lineas.filter(function (x) { return x.id_producto === d.id_producto; })[0];
        var rep = lin.reposiciones.filter(function (r) { return r.ref === d.ref; })[0];
        var clave = rep ? rep.clave : (d.ref || d.id_producto);
        estado.promesas.push({ clave: clave, ref: d.ref, cajas: d.cajas, id_pedido: idp });
        comprometidas.push((d.ref || clave) + ": " + d.cajas + " cajas");
      });
    });
    var partes = prom.entregas.map(function (e) { return e.cajas + " cajas el " + e.fecha; });
    res.promesa_confirmada = true; res.decision_cliente = "ACEPTA"; res.id_pedido = idp;
    res.respuesta = "ACEPTADA"; res.causa = "PROMESA_ALTERNATIVA_CONFIRMADA"; res.responsable = "ERP";
    res.estado_solicitud = "ACEPTADA_CON_PROMESA"; res.evento_respuesta = "CONFIRMAR_PROMESA";
    res.mensaje = "El cliente aceptó la entrega en dos momentos (" + partes.join(" + ") + "). Pedido " + idp + " creado (ID simulado), total S/ " + f2(cot.totales.total) + " con IGV.";
    res.siguiente_accion = "Planeamiento sostiene la fecha de la reposición; Almacén prepara lo reservado.";
    res.pendientes = comprometidas.length ? [{ rol: roles.planeamiento, accion: "Sostener la fecha de la producción programada", detalle: comprometidas.join("; ") }] : [];
    res.mensaje_respuesta.respuesta = "ACEPTADA"; res.mensaje_respuesta.id_pedido = idp; res.mensaje_respuesta.causa = res.causa;
    res.mensaje_respuesta.estado = res.estado_solicitud; res.mensaje_respuesta.responsable = "ERP";
    res.eventos.push({ paso: "RESERVA", control: "Reserva de stock (sesión)", resultado: "INFO",
                       detalle: "Se reservan las cajas disponibles hoy (" + (cajasRes.join(", ") || "ninguna") + ") y se compromete la reposición (" + (comprometidas.join(", ") || "ninguna") + ").", responsable: roles.almacen });
    res.eventos.push({ paso: "RESPUESTA", control: "CONFIRMAR_PROMESA", resultado: "ACEPTADA", detalle: res.mensaje, responsable: "ERP" });
    return res;
  }

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  // ------------------------------------------------- batería de pruebas
  function valorEn(res, ruta) {
    if (ruta.indexOf("ctl.") === 0) {
      var cid = ruta.slice(4), cs = res.controles || [];
      for (var i = 0; i < cs.length; i++) if (cs[i].id === cid) return cs[i].resultado;
      return "(no existe)";
    }
    var cur = res, partes = ruta.split(".");
    for (var k = 0; k < partes.length; k++) {
      var p = partes[k];
      if (Array.isArray(cur)) {
        if (!/^\d+$/.test(p) || +p >= cur.length) return "(no existe)";
        cur = cur[+p];
      } else if (esObj(cur) && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return "(no existe)";
    }
    return cur;
  }
  function igual(a, b) {
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
    return a === b;
  }
  function correrCaso(caso, datos, cfg, estado, hoy) {
    var res;
    if (caso.modo === "cotizar") res = cotizar(caso.entrada, datos, cfg, estado, hoy);
    else if (caso.modo === "previsualizar") res = previsualizar(caso.entrada, datos, cfg, estado, hoy);
    else if (caso.modo === "confirmar_promesa") res = confirmarPromesa(caso.entrada, datos, cfg, estado, hoy, caso.acepta === undefined ? true : caso.acepta);
    else res = solicitarPedido(caso.entrada, datos, cfg, estado, hoy);
    res.sesion = { pedidos: estado.pedidos.length, reservas: estado.reservas.length, promesas: estado.promesas.length, sol: estado.contadores.SOL };
    return res;
  }
  function ejecutarCaso(caso, porId, datos, cfg, hoy) {
    var estado = nuevoEstado();
    (caso.previos || []).forEach(function (pid) { correrCaso(porId[pid], datos, cfg, estado, hoy); });
    return correrCaso(caso, datos, cfg, estado, hoy);
  }
  /** Corre todos los casos y compara esperado vs observado. */
  function correrSuite(suite, datos, cfg) {
    var porId = {}; suite.casos.forEach(function (c) { porId[c.id] = c; });
    return suite.casos.map(function (caso) {
      var res = ejecutarCaso(caso, porId, datos, cfg, suite.hoy_pruebas);
      var detalle = Object.keys(caso.esperado).map(function (ruta) {
        var obs = valorEn(res, ruta), esp = caso.esperado[ruta];
        return { ruta: ruta, esperado: esp, observado: obs, ok: igual(obs, esp) };
      });
      return { caso: caso, res: res, detalle: detalle, ok: detalle.every(function (d) { return d.ok; }) };
    });
  }
  function resumenSuite(filas) {
    return filas.map(function (f) {
      var r = f.res;
      return { id: f.caso.id, titulo: f.caso.titulo, tipo: f.caso.tipo, descripcion: f.caso.descripcion, ok: f.ok,
               respuesta: r.respuesta || (r.cotizacion ? r.cotizacion.autorizacion.estado : "ERROR"), causa: r.causa || null, detalle: f.detalle };
    });
  }

  // ---------------------------------------------------------- bitácora
  var COLUMNAS_BITACORA = ["fecha_hora", "motor", "modo", "id_solicitud", "cliente", "cotizacion", "respuesta", "causa",
                           "responsable", "siguiente_accion", "id_pedido", "controles", "mensaje"];
  function filaBitacora(res, entrada) {
    entrada = esObj(entrada) ? entrada : {};
    var cot = res.cotizacion || {};
    var ctlTxt = (res.controles || []).map(function (c) { return c.id + "=" + c.resultado; }).join(" | ");
    var respuesta, causa, mensaje, rol, sig;
    if (res.modo === "cotizar") {
      var aut = cot.autorizacion || {};
      respuesta = aut.estado || (res.errores && res.errores.length ? "ERROR_DATOS" : "");
      mensaje = (res.errores || []).map(function (e) { return e.mensaje; }).join("; ") || aut.detalle || "";
      causa = cot.bloqueos && cot.bloqueos.length ? cot.bloqueos[0].causa : "";
      rol = "Ejecutivo comercial"; sig = "";
    } else { respuesta = res.respuesta || ""; causa = res.causa || ""; mensaje = res.mensaje || ""; rol = res.responsable || ""; sig = res.siguiente_accion || ""; }
    var d = new Date();
    var pad = function (x) { return ("0" + x).slice(-2); };
    var ahora = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    return {
      fecha_hora: ahora, motor: (res.motor ? res.motor.nombre + " " + res.motor.version : "?"), modo: res.modo || "",
      id_solicitud: res.id_solicitud || (esObj(entrada.solicitud) && entrada.solicitud.id) || "", cliente: entrada.cliente || "",
      cotizacion: res.etiqueta_cotizacion || cot.etiqueta || "", respuesta: respuesta, causa: causa, responsable: rol, siguiente_accion: sig,
      id_pedido: res.id_pedido || "", controles: ctlTxt, mensaje: mensaje
    };
  }
  function bitacoraACsv(filas) {
    function q(v) { v = v === null || v === undefined ? "" : String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var out = ["sep=;", COLUMNAS_BITACORA.join(";")];
    filas.forEach(function (f) { out.push(COLUMNAS_BITACORA.map(function (c) { return q(f[c]); }).join(";")); });
    return "\ufeff" + out.join("\r\n") + "\r\n";
  }

  var API = {
    VERSION_MOTOR: VERSION_MOTOR, TABLAS: TABLAS, cargarDatos: cargarDatos, nuevoEstado: nuevoEstado, cotizar: cotizar,
    solicitarPedido: solicitarPedido, previsualizar: previsualizar, confirmarPromesa: confirmarPromesa, registrarAprobacion: registrarAprobacion, correrSuite: correrSuite, resumenSuite: resumenSuite,
    valorEn: valorEn, filaBitacora: filaBitacora, bitacoraACsv: bitacoraACsv, COLUMNAS_BITACORA: COLUMNAS_BITACORA, hoyIso: hoyIso,
    _interno: { rhu: rhu, decAEntero: decAEntero, pyRound: pyRound, floorDiv: floorDiv }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.AgenteMotor = API;
})(typeof window !== "undefined" ? window : this);

