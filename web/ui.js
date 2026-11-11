/* Agente comercial de cara al cliente · pantalla (JavaScript puro, sin librerías ni internet) */
(function () {
  "use strict";
  var EMB = JSON.parse(document.getElementById("datos-embebidos").textContent);
  var FECHA_DEMO = "2026-11-10"; // fecha simulada: las fotos de stock y reposiciones de la tabla están alrededor de este día

  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, attrs) {
    var e = document.createElement(tag), i, a = attrs || {};
    Object.keys(a).forEach(function (k) {
      if (k === "class") e.className = a[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), a[k]);
      else if (a[k] !== null && a[k] !== undefined && a[k] !== false) e.setAttribute(k, a[k] === true ? "" : a[k]);
    });
    for (i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(e, x); }); else e.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function limpiar(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function pad(n) { return ("0" + n).slice(-2); }
  function hh(ts) { if (!ts) return ""; var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  var fecha = FECHA_DEMO;
  var A = ChatAgenteApi.crear({
    cliente: "CLI-001", fecha: function () { return fecha; },
    emit: function (ev, d) {
      if (ev === "msg") pintarMsg(d);
      else if (ev === "escribiendo") escribiendo(d);
      else if (ev === "cliente") { $("#cliente").value = d; }
      else if (ev === "tareas") { pintarBandeja(); pintarEstado(); }
      else if (ev === "traza") pintarTraza();
      else if (ev === "erp") pintarERP();
      else if (ev === "todo") { limpiar($("#msgs")); limpiar($("#chips")); pintarBandeja(); pintarTraza(); pintarERP(); pintarEstado(); }
      else if (ev === "error" && window.console) console.error(d);
    }
  });
  var U = A.utiles;

  // ------------------------------------------------------------------ chat
  function pintarMsg(m) {
    var cont = $("#msgs");
    quitarEscribiendo();
    if (m.rol === "cliente") {
      limpiar($("#chips"));
      cont.appendChild(h("div", { class: "fila cli" }, h("div", { class: "burb" }, h("p", null, m.texto), h("span", { class: "hora" }, hh(m.ts)))));
    } else {
      var b = h("div", { class: "burb" });
      m.bloques.forEach(function (x) { var n = bloque(x); if (n) b.appendChild(n); });
      b.appendChild(h("span", { class: "hora" }, hh(m.ts)));
      cont.appendChild(h("div", { class: "fila age" }, h("div", { class: "av" }, "A"), b));
      limpiar($("#chips"));
      (m.chips || []).forEach(function (c) {
        $("#chips").appendChild(h("button", { class: "chip", type: "button", onclick: function () { enviar(c.t, c.a); } }, c.t));
      });
    }
    pintarEstado();
    bajar();
  }
  function bajar() { var m = $("#msgs"); setTimeout(function () { m.scrollTop = m.scrollHeight; }, 20); }
  function escribiendo(v) {
    quitarEscribiendo();
    if (v) { $("#msgs").appendChild(h("div", { class: "fila age", id: "tipeo" }, h("div", { class: "av" }, "A"), h("div", { class: "burb escribiendo" }, h("span"), h("span"), h("span")))); bajar(); }
  }
  function quitarEscribiendo() { var t = $("#tipeo"); if (t) t.parentNode.removeChild(t); }

  function bloque(b) {
    switch (b.k) {
      case "p": return b.t ? h("p", null, b.t) : null;
      case "cot": return cardCot(b);
      case "espera": return h("div", { class: "espera-c" }, h("span", { class: "dot" }), h("span", null, b.rol + " · " + b.texto));
      case "entregas": return h("div", { class: "ent" }, b.items.map(function (i) { return h("div", null, h("b", null, i.fecha + " · " + i.cajas + " cajas"), i.detalle.map(function (d) { return h("small", null, d); })); }));
      case "pedido":
        return h("div", { class: "ped" }, h("h4", null, "✔ Pedido " + b.id),
          h("div", { class: "kv" }, h("span", null, "Cotización"), h("b", null, b.cotizacion)), h("div", { class: "kv" }, h("span", null, "Solicitud"), h("b", null, b.solicitud)),
          h("div", { class: "kv" }, h("span", null, "Cajas"), h("b", null, b.cajas)), h("div", { class: "kv" }, h("span", null, "Total con IGV"), h("b", null, U.soles(b.total))),
          b.entregas.map(function (e) { return h("div", { class: "kv" }, h("span", null, "Entrega"), h("b", null, e.fecha + " · " + e.cajas + " cajas")); }),
          h("small", null, "ID simulado: el pedido real lo emitiría el ERP."));
      case "catalogo": return h("div", { class: "cat" }, b.items.map(function (i) { return h("div", null, h("span", null, i.nombre, h("small", null, i.presentacion)), h("b", null, U.soles(i.precio))); }));
    }
    return null;
  }
  function cardCot(b) {
    var t = b.totales, con = b.desc > 0;
    return h("div", { class: "cot" },
      h("div", { class: "cot-h" }, h("b", null, "Cotización " + b.etiqueta), h("span", { class: "tag" + (con ? " ok" : "") }, con ? U.pct(b.desc) + " de descuento" : "Sin descuento")),
      h("table", null,
        h("thead", null, h("tr", null, h("th", null, "Producto"), h("th", { class: "n" }, "Cajas"), h("th", { class: "n" }, "P. caja"), h("th", { class: "n" }, "Subtotal"))),
        h("tbody", null, b.lineas.map(function (l) {
          return h("tr", null, h("td", null, l.nombre), h("td", { class: "n" }, l.cajas), h("td", { class: "n" }, con ? h("s", null, U.soles(l.lista)) : null, U.soles(l.neto)), h("td", { class: "n" }, U.soles(l.subtotal)));
        })),
        h("tfoot", null,
          con ? h("tr", null, h("td", { colspan: 3 }, "Valor de lista"), h("td", { class: "n" }, U.soles(t.lista))) : null,
          con ? h("tr", null, h("td", { colspan: 3 }, "Descuento (" + U.pct(b.desc) + ")"), h("td", { class: "n" }, "− " + U.soles(t.descuento))) : null,
          h("tr", null, h("td", { colspan: 3 }, "Subtotal"), h("td", { class: "n" }, U.soles(t.subtotal))),
          h("tr", null, h("td", { colspan: 3 }, "IGV (18 %)"), h("td", { class: "n" }, U.soles(t.igv))),
          h("tr", { class: "tot" }, h("td", { colspan: 3 }, "Total"), h("td", { class: "n" }, U.soles(t.total))))),
      h("div", { class: "cot-f" }, h("span", null, b.origen), h("span", null, "Vigente hasta " + U.fmtF(b.vigencia) + " · Entrega " + U.fmtF(b.entrega))));
  }

  function enviar(texto, accion) {
    texto = (texto || "").trim(); if (!texto) return;
    $("#txt").value = ""; A.recibir(texto, accion);
  }

  function pintarEstado() {
    var S = A.estado(), c = S.conv, e = $("#estado"), cls = "estado", txt = "Sin gestión en curso. Escriba su pedido.";
    var pend = c.cots.filter(function (q) { return q.estado === "PENDIENTE_JEFATURA" || q.estado === "PENDIENTE_FINANZAS"; });
    var of = c.cots.filter(function (q) { return q.estado === "OFRECIDA"; });
    if (c.cerrado && c.pedido) { cls += " ok"; txt = "Pedido " + c.pedido + " registrado."; }
    else if (pend.length) { cls += " espera"; txt = "En espera de " + (pend[0].estado === "PENDIENTE_FINANZAS" ? "Finanzas (crédito)" : "la Jefatura Comercial (descuento de " + U.pct(pend[0].desc) + ")") + " · " + pend[0].etiqueta; }
    else if (of.length) txt = "Cotización vigente: " + of[of.length - 1].etiqueta + " · pendiente de su confirmación.";
    e.className = cls; limpiar(e); e.appendChild(h("span", { class: "dot" })); e.appendChild(h("span", null, txt));
  }

  // ------------------------------------------------------------- bandeja
  function claseRol(r) { return /Jefatura/.test(r) ? "jef" : /Finanzas$/.test(r) ? "fin" : /Planeamiento/.test(r) ? "pl" : /Datos/.test(r) ? "md" : ""; }
  function pintarBandeja() {
    var S = A.estado(), cont = limpiar($("#bandeja")), pend = S.tareas.filter(function (t) { return t.estado === "PENDIENTE"; });
    var hist = S.tareas.filter(function (t) { return t.estado !== "PENDIENTE"; }).reverse();
    var bd = $("#bd"); bd.textContent = pend.length; bd.className = "bd" + (pend.length ? " on" : "");
    cont.appendChild(h("p", { class: "ayuda" }, "Aquí llegan las decisiones que el agente no puede tomar. Usted hace el papel de la persona con autoridad; al decidir, el chat del cliente continúa solo."));
    if (!pend.length) cont.appendChild(h("div", { class: "vacio" }, "Sin solicitudes pendientes.", h("br"), "Pida un descuento mayor a 5 % o un monto sobre su crédito y aparecerá aquí."));
    pend.forEach(function (t) { cont.appendChild(cardTarea(t)); });
    if (hist.length) { cont.appendChild(h("h3", null, "Ya resueltas")); hist.forEach(function (t) {
      cont.appendChild(h("div", { class: "tarea res " + t.estado }, h("div", { class: "t-h" }, h("span", { class: "rol " + claseRol(t.rol) }, t.rol), h("span", { class: "pill " + (t.estado === "APROBADA" ? "ok" : t.estado === "RECHAZADA" ? "mal" : "") }, t.estado), h("span", { class: "id" }, t.id + " · " + hh(t.resuelta))),
        h("div", { class: "mini" }, t.titulo + (t.resultado ? " — " + t.resultado : ""))));
    }); }
  }
  function si(v) { return h("span", { class: v ? "si" : "no" }, v ? "Sí" : "No"); }
  function cardTarea(t) {
    var errEl = h("div", { class: "err" }), cuerpo = [], acc;
    var mot = h("input", { class: "mot", type: "text", placeholder: "Motivo (opcional)" });
    function decidir(aprobar, valorEl) {
      errEl.textContent = "";
      A.resolver(t.id, { aprobar: aprobar, valor: valorEl ? valorEl.value : null, motivo: mot.value.trim() }).then(function (r) { if (r && !r.ok) errEl.textContent = r.error; });
    }
    if (t.tipo === "DESCUENTO") {
      var f = t.ficha || {}, v = h("input", { type: "number", min: "0", max: "10", step: "0.5", value: t.solicitado });
      cuerpo.push(h("div", { class: "ficha" },
        h("div", null, h("span", null, "Descuento pedido"), h("b", null, U.pct(t.solicitado))), h("div", null, h("span", null, "Total con IGV"), h("b", null, U.soles(t.total))),
        h("div", null, h("span", null, "Canal"), h("b", null, f.canal || "—")), h("div", null, h("span", null, "Volumen / umbral"), h("b", null, (f.volumen_cajas || 0) + " / " + (f.umbral_volumen || 0) + " cajas")),
        h("div", null, h("span", null, "Márgenes sobre el mínimo"), h("b", null, si(f.margenes_ok))), h("div", null, h("span", null, "Compras previas"), h("b", null, f.compras_previas)),
        h("div", null, h("span", null, "Crédito disponible"), h("b", null, U.soles(f.credito_disponible || 0))), h("div", null, h("span", null, "Crédito alcanza"), h("b", null, si(f.credito_alcanza)))));
      acc = h("div", { class: "acc" }, h("label", null, "Aprobar hasta (%)", v), h("label", null, "Motivo", mot),
        h("button", { class: "btn ok", type: "button", onclick: function () { decidir(true, v); } }, "Aprobar"), h("button", { class: "btn mal", type: "button", onclick: function () { decidir(false); } }, "Rechazar"));
    } else if (t.tipo === "CREDITO") {
      var cr = t.credito || {}, m = h("input", { type: "number", min: "0", step: "0.01", value: Math.ceil(t.total * 100) / 100 });
      cuerpo.push(h("div", { class: "ficha" },
        h("div", null, h("span", null, "Línea de crédito"), h("b", null, U.soles(cr.linea || 0))), h("div", null, h("span", null, "Deuda vigente"), h("b", null, U.soles(cr.deuda_vigente || 0))),
        h("div", null, h("span", null, "Disponible"), h("b", null, U.soles(cr.disponible || 0))), h("div", null, h("span", null, "Total del pedido"), h("b", null, U.soles(t.total))),
        h("div", { class: "full" }, h("span", null, "Exceso a cubrir"), h("b", { class: "no" }, U.soles(Math.max(0, t.total - (cr.disponible || 0)))))));
      acc = h("div", { class: "acc" }, h("label", null, "Monto máximo aprobado (S/)", m), h("label", null, "Motivo", mot),
        h("button", { class: "btn ok", type: "button", onclick: function () { decidir(true, m); } }, "Aprobar crédito"), h("button", { class: "btn mal", type: "button", onclick: function () { decidir(false); } }, "Rechazar"));
      cuerpo.push(h("div", { class: "mini" }, "El monto aprobado debe cubrir el total del pedido (así lo valida el ERP)."));
    } else if (t.tipo === "ALTA_CLIENTE") {
      var l = h("input", { type: "number", min: "0", step: "100", value: "10000" });
      acc = h("div", { class: "acc" }, h("label", null, "Línea de crédito inicial (S/)", l), h("label", null, "Motivo", mot),
        h("button", { class: "btn ok", type: "button", onclick: function () { decidir(true, l); } }, "Habilitar en el ERP"), h("button", { class: "btn mal", type: "button", onclick: function () { decidir(false); } }, "No habilitar"));
    } else {
      acc = h("div", { class: "acc" }, h("label", null, "Respuesta", mot), h("button", { class: "btn az", type: "button", onclick: function () { decidir(false); } }, "No hay fecha sustentada"));
    }
    return h("div", { class: "tarea" }, h("div", { class: "t-h" }, h("span", { class: "rol " + claseRol(t.rol) }, t.rol), h("span", { class: "pill alerta" }, "Pendiente"), h("span", { class: "id" }, t.id + " · " + hh(t.creada))),
      h("h4", null, t.titulo), t.tipo !== "DESCUENTO" && t.detalle ? h("p", null, t.detalle) : null, cuerpo, acc, errEl);
  }

  // --------------------------------------------------------------- traza
  function pintarERP() {
    var S = A.estado(), e = S.ultimoERP, cont = limpiar($("#erp"));
    if (!e) { cont.appendChild(h("div", { class: "vacio" }, "El ERP todavía no ha validado ninguna cotización.")); return; }
    cont.appendChild(h("div", { class: "erp" },
      h("div", { class: "erp-h" }, h("b", null, "Último chequeo del ERP · " + e.etiqueta), h("span", { class: "pill " + e.respuesta }, e.respuesta || "—"), e.modo === "previsualizar" ? h("span", { class: "pill" }, "simulacro: no reserva ni crea pedido") : null),
      e.mensaje ? h("div", { class: "ctl" }, h("span"), h("small", { style: "grid-column:1/-1" }, e.mensaje)) : null,
      e.controles.map(function (c) { return h("div", { class: "ctl" }, h("code", null, c.id), h("span", null, c.nombre), h("span", { class: "pill " + c.resultado }, c.resultado.replace("_", " ")), c.detalle ? h("small", null, c.detalle + (c.responsable ? " · Responsable: " + c.responsable : "")) : null); })));
  }
  function pintarTraza() {
    var S = A.estado(), cont = limpiar($("#linea"));
    if (!S.traza.length) { cont.appendChild(h("div", { class: "vacio" }, "Aquí se registra, paso a paso, qué hizo el agente, qué respondió el ERP y qué decidió cada persona.")); return; }
    cont.appendChild(h("div", { class: "tl" }, S.traza.slice().reverse().map(function (t) {
      return h("div", { class: "tl-i" }, h("span", { class: "h" }, hh(t.ts)), h("span", null, h("span", { class: "pill " + t.tipo }, t.actor)), h("span", null, t.texto), t.detalle ? h("small", null, t.detalle) : null);
    })));
  }

  // ---------------------------------------------------------- escenarios
  var ESCENARIOS = [
    { t: "Pedido sencillo", d: "Stock y crédito alcanzan: cotiza y registra el pedido.", c: "CLI-001", m: "Quiero 100 cajas de leche UHT entera para el viernes", p: "Luego pulse «Confirmo»." },
    { t: "Descuento de 8 %: espera a la Jefatura", d: "Entre 5 % y 10 % no lo decide el agente: escala y el chat queda en espera.", c: "CLI-001", m: "Necesito 150 cajas de leche UHT entera con 8 % de descuento", p: "Vaya a Bandeja interna y apruebe o rechace." },
    { t: "Pedir otro descuento después de cotizar", d: "Cada descuento nuevo es una versión nueva con su propia validación.", c: "CLI-001", m: "Quiero 150 cajas de leche UHT entera", p: "Después escriba: «¿me puede dar 9 % de descuento?»" },
    { t: "Descuento fuera de política (12 %)", d: "Sobre 10 % nadie lo autoriza: ofrece lo máximo permitido.", c: "CLI-001", m: "Quiero 100 cajas de leche UHT entera con 12 % de descuento", p: "Pruebe el botón «Solicitar 10 %»." },
    { t: "Crédito insuficiente", d: "El total supera el crédito disponible: escala a Finanzas.", c: "CLI-102", m: "Quiero 50 cajas de leche UHT entera", p: "Confirme y luego resuelva en Bandeja interna." },
    { t: "Falta stock, hay reposición sustentada", d: "Propone entrega en dos momentos; sin aceptación no hay pedido.", c: "CLI-001", m: "Necesito 60 cajas de leche evaporada para pasado mañana", p: "Acepte o rechace la entrega en dos momentos." },
    { t: "Falta stock, sin fecha sustentada", d: "El agente no inventa fechas: ofrece lo disponible o consulta a Planeamiento.", c: "CLI-001", m: "Necesito 100 cajas de leche evaporada", p: "Pruebe «Pedir solo lo disponible»." },
    { t: "Cliente no habilitado en el ERP", d: "Cotiza como referencia y pide el alta a Datos maestros.", c: "CLI-002", m: "Quiero 10 cajas de leche UHT entera", p: "Habilite al cliente en Bandeja interna." },
    { t: "Producto ambiguo y producto sin costeo", d: "Pregunta cuál presentación y no cotiza lo que no tiene precio revisado.", c: "CLI-001", m: "Quiero 50 cajas de leche UHT", p: "Luego pruebe «yogurt vainilla»." }
  ];
  function pintarEscenarios() {
    var cont = limpiar($("#escen"));
    cont.appendChild(h("p", { class: "ayuda" }, "Cada escenario reinicia la sesión, cambia de cliente y escribe el primer mensaje por usted. También puede escribir libremente en el chat."));
    ESCENARIOS.forEach(function (e) {
      cont.appendChild(h("div", { class: "esc" }, h("div", null, h("b", null, e.t), h("p", null, e.d), h("span", { class: "pide" }, "«" + e.m + "» · " + e.p)),
        h("button", { class: "btn az", type: "button", onclick: function () { probar(e); } }, "Probar")));
    });
  }
  function probar(e) {
    $("#cliente").value = e.c; fecha = FECHA_DEMO; $("#fecha").value = fecha;
    A.reiniciar(e.c).then(function () { setTimeout(function () { enviar(e.m); }, 400); });
  }

  // ------------------------------------------------------- cómo funciona
  function pintarDoc() {
    var c = limpiar($("#doc"));
    c.appendChild(h("div", { class: "doc" }, h("h3", null, "Quién hace qué"),
      h("div", { class: "flujo" },
        h("div", { class: "caja" }, h("h4", null, "Cliente"), h("ul", null, h("li", null, "Pide productos, cajas y fecha"), h("li", null, "Puede pedir descuento"), h("li", null, "Decide si acepta la cotización"))),
        h("div", { class: "flecha" }, "⇄"),
        h("div", { class: "caja age" }, h("h4", null, "Agente comercial (lado CRM)"), h("ul", null,
          h("li", null, "Interpreta el mensaje"), h("li", null, "Cotiza y versiona (V01, V02…)"), h("li", null, "Autoriza solo hasta " + EMB.config.tramos_descuento.ejecutivo_max_pct + " %"),
          h("li", null, "Escala lo que no le corresponde y espera"), h("li", null, "Solo muestra al cliente lo que le corresponde"))),
        h("div", { class: "flecha" }, "⇄"),
        h("div", { class: "caja erpc" }, h("h4", null, "ERP (motor de reglas)"), h("ul", null,
          h("li", null, "C0 datos y no duplicidad"), h("li", null, "C1 cliente habilitado y vigencia"), h("li", null, "C2 descuento y margen"), h("li", null, "C3 crédito"), h("li", null, "C4 stock liberado"), h("li", null, "Crea el pedido y reserva")))),
      h("div", { class: "humanos" }, "Personas con autoridad (el agente no decide por ellas): Jefatura Comercial · descuento 5–10 % — Finanzas · exceso de crédito — Planeamiento · fecha de reposición — Datos maestros · alta de cliente")));
    c.appendChild(h("div", { class: "doc" }, h("h3", null, "Cómo se conecta con el contrato CRM–ERP de la Semana 6"),
      h("table", null, h("thead", null, h("tr", null, h("th", null, "Dimensión"), h("th", null, "Lo que entrega el agente (CRM)"), h("th", null, "Lo que valida o devuelve el ERP"))),
        h("tbody", null,
          h("tr", null, h("td", null, "Identidad"), h("td", null, "Cliente que ingresa al chat (ID de cliente)"), h("td", null, "Cliente habilitado, crédito (C1, C3)")),
          h("tr", null, h("td", null, "Oferta"), h("td", null, "Productos, cajas, descuento, moneda y vigencia"), h("td", null, "Catálogo, regla de precio y autorización (C2)")),
          h("tr", null, h("td", null, "Promesa"), h("td", null, "Fecha de entrega solicitada"), h("td", null, "Disponibilidad y reposición (C4)")),
          h("tr", null, h("td", null, "Trazabilidad"), h("td", null, "ID de cotización y versión; ID de solicitud"), h("td", null, "ID de pedido o causa de rechazo")),
          h("tr", null, h("td", null, "Gobierno"), h("td", null, "ID de aprobación de Jefatura o Finanzas"), h("td", null, "Permisos, controles y bitácora"))))));
    c.appendChild(h("div", { class: "doc" }, h("h3", null, "Qué hace y qué no hace"),
      h("ul", null,
        h("li", null, "Sí: cotiza con precios del catálogo, aplica IGV, versiona cada cambio y deja bitácora (CSV en la cabecera)."),
        h("li", null, "Sí: espera. Si el descuento o el crédito exceden su facultad, la conversación queda en espera hasta que una persona decida en la bandeja."),
        h("li", null, "No: aprobar descuentos sobre 5 %, ni crédito, ni inventar precios, stock o fechas. Costos y márgenes no se muestran al cliente."),
        h("li", null, "El pedido y la reserva los hace el ERP; el ID de pedido es simulado."))));
    c.appendChild(h("div", { class: "doc" }, h("h3", null, "Cómo entiende el mensaje del cliente"),
      h("p", { class: "mini", style: "margin:0 0 6px" }, "Hoy usa un intérprete por reglas en el servidor (sin IA generativa): reconoce productos del catálogo, cantidades (también escritas con letras), porcentajes de descuento, fechas relativas («el viernes», «pasado mañana», «en 3 días») y frases de confirmación. Los botones bajo el chat dan una vía directa y confiable."),
      h("p", { class: "mini", style: "margin:0" }, "Mejora posible (trabajo futuro): reemplazar este intérprete por un modelo de lenguaje en el servidor. Aun así, el modelo solo traduciría el mensaje: el precio, el descuento, el stock y el crédito seguirían saliendo del motor de reglas y validándose contra el catálogo.")));
    c.appendChild(h("div", { class: "doc" }, h("h3", null, "Supuestos"), h("ul", null,
      h("li", null, "Datos sintéticos del caso académico (productos, clientes, lotes y aprobaciones de ejemplo), guardados en una base de datos (Supabase). Cada visitante tiene su propia sesión de prueba, aislada de las demás."),
      h("li", null, "Las decisiones de Jefatura, Finanzas, Planeamiento y Datos maestros las simula quien opera la demostración."),
      h("li", null, "La fecha del sistema está fijada en 10/11/2026 para que el stock y las reposiciones del caso den resultados reproducibles; se puede cambiar arriba."))));
  }

  // ---------------------------------------------------------------- arranque
  function iniciar() {
    EMB.tablas.clientes.forEach(function (c) {
      $("#cliente").appendChild(h("option", { value: c.id_cliente }, c.nombre_comercial + " · " + c.id_cliente + (String(c.habilitado_erp).toUpperCase() === "SI" ? "" : " (no habilitado)")));
    });
    $("#cliente").addEventListener("change", function () { A.setCliente(this.value); });
    $("#fecha").value = fecha;
    $("#fecha").addEventListener("change", function () { if (/^\d{4}-\d{2}-\d{2}$/.test(this.value)) fecha = this.value; });
    $("#reiniciar").addEventListener("click", function () { A.reiniciar($("#cliente").value); });
    $("#csv").addEventListener("click", function () { $("#csvtxt").value = "Cargando…"; $("#csvmsg").textContent = ""; $("#modal").hidden = false; A.csv().then(function (t) { $("#csvtxt").value = t; }); });
    $("#csvcerrar").addEventListener("click", function () { $("#modal").hidden = true; });
    $("#csvcopiar").addEventListener("click", function () {
      var ta = $("#csvtxt"), ok = function () { $("#csvmsg").textContent = "Copiado."; }, no = function () { ta.select(); $("#csvmsg").textContent = "Seleccione el texto y copie con Ctrl+C."; };
      try { navigator.clipboard.writeText(ta.value).then(ok, no); } catch (e) { no(); }
    });
    $("#form").addEventListener("submit", function (ev) { ev.preventDefault(); enviar($("#txt").value); });
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (x) { x.classList.toggle("on", x === b); });
        Array.prototype.forEach.call(document.querySelectorAll(".pane"), function (p) { p.classList.toggle("on", p.id === "pane-" + b.dataset.t); });
      });
    });
    pintarBandeja(); pintarTraza(); pintarERP(); pintarEscenarios(); pintarDoc(); pintarEstado();
    A.saludar(); // si esta persona ya tenía una sesión, el servidor devuelve su conversación
    window.__agente = A; // útil para pruebas desde la consola
  }
  iniciar();
})();
