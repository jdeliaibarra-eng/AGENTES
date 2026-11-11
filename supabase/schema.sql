-- ============================================================
-- Agente comercial · caso Gloria (GE703 PC3)
-- Pegue TODO este archivo en Supabase > SQL Editor y pulse Run.
-- Es seguro ejecutarlo de nuevo: borra y vuelve a crear las tablas del caso.
-- Datos ficticios del caso académico.
-- ============================================================

drop table if exists productos, clientes, stock_lotes, aprobaciones cascade;
drop table if exists sesiones cascade;

create table productos (
  id_producto text not null default '',
  sku text not null default '',
  nombre text not null default '',
  familia text not null default '',
  presentacion text not null default '',
  unid_caja text not null default '',
  conservacion text not null default '',
  vida_util_dias text not null default '',
  precio_base_caja text not null default '',
  costo_caja text not null default '',
  margen_minimo_pct text not null default '',
  vida_util_min_entrega_pct text not null default '',
  origen text not null default '',
  primary key (id_producto)
);

insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-001', 'GL-UHT-1L', 'Leche UHT Gloria entera', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Ambiente', '180', '60', '45', '15', '', 'CASO PC2 (sintético)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-002', 'GL-EVA-400', 'Leche evaporada Gloria', 'Leches', 'Caja x 48 latas de 400 g', '48', 'Ambiente', '365', '168', '128', '15', '', 'CASO PC2 (sintético)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-003', 'GL-FRE-1L', 'Leche fresca pasteurizada Gloria', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Refrigerada', '21', '54', '35', '25', '70', 'CASO PC2 (sintético)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-004', 'GL-LAC-01', 'Leche sin lactosa Gloria', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Ambiente', '180', '72', '55', '15', '', 'SUPUESTO G6 (costo y margen supuestos del grupo)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-005', 'GL-LAC-02', 'Leche UHT Gloria descremada', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Ambiente', '180', '65', '49', '15', '', 'SUPUESTO G6 (costo y margen supuestos del grupo)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-006', 'GL-LAC-03', 'Leche evaporada Gloria ligera', 'Leches', 'Caja x 48 latas', '48', 'Ambiente', '365', '175', '134', '15', '', 'SUPUESTO G6 (costo y margen supuestos del grupo)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-007', 'GL-YOG-01', 'Yogurt Gloria sabor fresa', 'Yogurt', 'Caja x 12 botellas', '12', 'Refrigerada', '28', '94', '66', '25', '70', 'SUPUESTO G6 (costo y margen supuestos del grupo)');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-101', 'GL-UHT-ECO', 'Leche Gloria UHT económica', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Ambiente', '180', '100', '88', '15', '', 'SINTÉTICO PC3');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-102', 'GL-UHT-LGT', 'Leche UHT Gloria light', 'Leches', 'Caja x 12 envases de 1 L', '12', 'Ambiente', '180', '80', '50', '15', '', 'SINTÉTICO PC3');
insert into productos (id_producto, sku, nombre, familia, presentacion, unid_caja, conservacion, vida_util_dias, precio_base_caja, costo_caja, margen_minimo_pct, vida_util_min_entrega_pct, origen) values ('PRD-008', 'GL-YOG-02', 'Yogurt Gloria sabor vainilla', 'Yogurt', 'Caja x 12 botellas', '12', 'Refrigerada', '28', '94', '', '', '', 'ILUSTRATIVO (producto nuevo, aún sin costeo)');

create table clientes (
  id_cliente text not null default '',
  cuenta_crm text not null default '',
  razon_social text not null default '',
  nombre_comercial text not null default '',
  canal text not null default '',
  distrito text not null default '',
  estado_comercial text not null default '',
  habilitado_erp text not null default '',
  linea_credito text not null default '',
  plazo_dias text not null default '',
  deuda_vigente text not null default '',
  compras_previas text not null default '',
  origen text not null default '',
  primary key (id_cliente)
);

insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-001', 'CTA-LA-001', 'Distribuidora Mayorista La Alameda S.A.C.', 'La Alameda', 'Mayorista', 'Ate', 'Ganada comercialmente', 'SI', '30000', '30', '0', '0', 'CASO PC2 (sintético; habilitación y crédito son supuestos del caso)');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-002', 'CTA-002', 'Distribuciones Nuevo Horizonte S.A.C.', 'Nuevo Horizonte', 'Mayorista', 'Santa Anita', 'Oportunidad en negociación', 'NO', '0', '0', '0', '0', 'CASO PC2 (sintético)');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-003', 'CTA-003', 'Abastecimientos Del Sol S.A.C.', 'Del Sol', 'Mayorista', 'San Juan de Lurigancho', 'Oportunidad abierta', 'NO', '0', '0', '0', '0', 'CASO PC2 (sintético)');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-004', 'CTA-004', 'Mayorista San Joaquín S.A.C.', 'San Joaquín', 'Mayorista', 'Chosica', 'Lead calificado', 'NO', '0', '0', '0', '0', 'CASO PC2 (sintético)');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-101', 'CTA-101', 'Distribuidora Santa Rosa S.A.C.', 'Santa Rosa', 'Mayorista', 'Lima', 'Cliente activo', 'SI', '60000', '30', '5000', '4', 'SINTÉTICO PC3');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-102', 'CTA-102', 'Autoservicios El Progreso S.A.C.', 'El Progreso', 'Autoservicio', 'Lima', 'Cliente activo', 'SI', '20000', '30', '19000', '6', 'SINTÉTICO PC3');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-103', 'CTA-103', 'Bodegas Unidas del Norte S.A.C.', 'Bodegas Unidas', 'Minorista', 'Comas', 'Cliente activo', 'SI', '8000', '15', '0', '2', 'SUPUESTO G6 (cliente adicional para pruebas)');
insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ('CLI-104', 'CTA-104', 'Catering Los Olivos S.A.C.', 'Catering Los Olivos', 'Institucional', 'Los Olivos', 'Cliente activo', 'SI', '15000', '30', '3000', '1', 'SUPUESTO G6 (cliente adicional para pruebas)');

create table stock_lotes (
  fecha_corte text not null default '',
  id_lote text not null default '',
  id_producto text not null default '',
  almacen text not null default '',
  cajas text not null default '',
  estado_calidad text not null default '',
  fecha_produccion text not null default '',
  fecha_vencimiento text not null default '',
  reposicion_cajas text not null default '',
  reposicion_fecha text not null default '',
  reposicion_ref text not null default '',
  origen text not null default '',
  primary key (fecha_corte, id_lote)
);

insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-UHT-0915', 'PRD-001', 'ALM-PT-01', '300', 'LIBERADO', '2026-09-15', '2027-03-14', '', '', '', 'SUPUESTO G6 (foto previa a SOL-LA-001)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-EVA-0803', 'PRD-002', 'ALM-PT-01', '100', 'LIBERADO', '2026-08-03', '2027-08-03', '', '', '', 'SUPUESTO G6 (foto previa a SOL-LA-001)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-FRE-1001', 'PRD-003', 'ALM-PT-01', '150', 'LIBERADO', '2026-10-01', '2026-10-22', '', '', '', 'SUPUESTO G6 (foto previa a SOL-LA-001)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-UHT-1020', 'PRD-001', 'ALM-PT-01', '250', 'LIBERADO', '2026-10-20', '2027-04-18', '', '', '', 'SUPUESTO G6 (foto previa a SOL-LA-002)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-EVA-0811', 'PRD-002', 'ALM-PT-01', '40', 'LIBERADO', '2026-08-11', '2027-08-11', '20', '2026-11-17', 'OP-EVA-1711', 'SUPUESTO G6 (EP: 40 liberadas; OP-EVA-1711 libera 20 cajas el 17/11)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-EVA-1105', 'PRD-002', 'ALM-PT-01', '30', 'EN_INSPECCION', '2026-11-05', '2027-11-05', '', '', '', 'SINTÉTICO PC3 (lote sin liberación de Calidad)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-FRE-1110', 'PRD-003', 'ALM-PT-01', '120', 'LIBERADO', '2026-11-10', '2026-12-01', '', '', '', 'SUPUESTO G6 (foto previa a SOL-LA-002)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-FRE-1028', 'PRD-003', 'ALM-PT-01', '80', 'LIBERADO', '2026-10-28', '2026-11-18', '', '', '', 'SINTÉTICO PC3 (lote con poca vida útil restante)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-U102-1101', 'PRD-102', 'ALM-PT-01', '500', 'LIBERADO', '2026-11-01', '2027-04-30', '', '', '', 'SINTÉTICO PC3');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-LAC-0910', 'PRD-004', 'ALM-PT-01', '220', 'LIBERADO', '2026-09-10', '2027-03-09', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-DES-0912', 'PRD-005', 'ALM-PT-01', '260', 'LIBERADO', '2026-09-12', '2027-03-11', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-EVL-0820', 'PRD-006', 'ALM-PT-01', '90', 'LIBERADO', '2026-08-20', '2027-08-20', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-LAC-0910', 'PRD-004', 'ALM-PT-01', '220', 'LIBERADO', '2026-09-10', '2027-03-09', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-DES-0912', 'PRD-005', 'ALM-PT-01', '260', 'LIBERADO', '2026-09-12', '2027-03-11', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-EVL-0820', 'PRD-006', 'ALM-PT-01', '90', 'LIBERADO', '2026-08-20', '2027-08-20', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-10-01', 'LT-YOG-0930', 'PRD-007', 'ALM-PT-01', '100', 'LIBERADO', '2026-09-30', '2026-10-28', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');
insert into stock_lotes (fecha_corte, id_lote, id_producto, almacen, cajas, estado_calidad, fecha_produccion, fecha_vencimiento, reposicion_cajas, reposicion_fecha, reposicion_ref, origen) values ('2026-11-10', 'LT-YOG-1108', 'PRD-007', 'ALM-PT-01', '140', 'LIBERADO', '2026-11-08', '2026-12-06', '', '', '', 'SUPUESTO G6 (stock inicial de los productos del catálogo)');

create table aprobaciones (
  id_aprobacion text not null default '',
  tipo text not null default '',
  rol_aprobador text not null default '',
  aplica_a text not null default '',
  valor_maximo text not null default '',
  vigente_hasta text not null default '',
  motivo text not null default '',
  origen text not null default '',
  primary key (id_aprobacion)
);

insert into aprobaciones (id_aprobacion, tipo, rol_aprobador, aplica_a, valor_maximo, vigente_hasta, motivo, origen) values ('AUT-LA-001', 'DESCUENTO', 'JEFATURA_COMERCIAL', 'COT-LA-001-V02', '10', '2026-10-10', 'Cliente mayorista; 360 cajas sobre umbral 300; márgenes sobre mínimo. Excepción solo para V02', 'CASO PC2 (sintético)');
insert into aprobaciones (id_aprobacion, tipo, rol_aprobador, aplica_a, valor_maximo, vigente_hasta, motivo, origen) values ('AUT-LA-002', 'DESCUENTO', 'JEFATURA_COMERCIAL', 'COT-LA-002-V02', '10', '2026-11-19', 'Segunda compra mensual; misma condición autorizada solo para esta cotización', 'CASO PC2/EP (sintético)');
insert into aprobaciones (id_aprobacion, tipo, rol_aprobador, aplica_a, valor_maximo, vigente_hasta, motivo, origen) values ('APR-CRE-LA-001', 'CREDITO', 'FINANZAS', 'COT-LA-001-V01', '30831.98', '2026-10-06', 'Ampliación puntual de línea para V01 (4.5 %)', 'SINTÉTICO PC3');

-- Una fila por visitante: aquí vive su conversación, sus cotizaciones, tareas y bitácora.
create table sesiones (
  id text primary key,
  estado jsonb not null default '{}'::jsonb,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index sesiones_actualizado_idx on sesiones (actualizado);

-- Seguridad: la API del servidor entra con la conexión directa a Postgres.
-- Con RLS activado y sin políticas, nadie puede leer estas tablas por la API pública de Supabase.
alter table productos enable row level security;
alter table clientes enable row level security;
alter table stock_lotes enable row level security;
alter table aprobaciones enable row level security;
alter table sesiones enable row level security;
