import express from "express";
import db from "../db.js";

const router = express.Router();

const CLASIFICACIONES = {
  CON_EXISTENCIA_SUFICIENTE: "CON_EXISTENCIA_SUFICIENTE",
  EXISTENCIA_PARCIAL_INSUFICIENTE: "EXISTENCIA_PARCIAL_INSUFICIENTE",
  SIN_EXISTENCIA: "SIN_EXISTENCIA",
  SIN_DATO_INVENTARIO: "SIN_DATO_INVENTARIO"
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInt(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function buildWhere(query, options = {}) {
  const where = [];
  const params = [];

  if (query.periodo) {
    where.push("periodo = ?");
    params.push(String(query.periodo).trim());
  }

  if (query.from) {
    where.push("fecha >= ?");
    params.push(String(query.from).trim());
  }

  if (query.to) {
    where.push("fecha <= ?");
    params.push(String(query.to).trim());
  }

  if (query.surtidor) {
    where.push("surtidor = ?");
    params.push(String(query.surtidor).trim());
  }

  if (query.clasificacion) {
    where.push("clasificacion = ?");
    params.push(String(query.clasificacion).trim());
  }

  if (query.producto) {
    where.push("(codigo_producto LIKE ? OR producto LIKE ?)");
    const search = `%${String(query.producto).trim()}%`;
    params.push(search, search);
  }

  if (options.onlyWithFecha) {
    where.push("fecha IS NOT NULL");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return {
    whereSql,
    params
  };
}

function addCodigoProductoFilter(whereSql, params, codigoProducto) {
  const nextParams = [...params, codigoProducto];

  if (whereSql) {
    return {
      whereSql: `${whereSql} AND codigo_producto = ?`,
      params: nextParams
    };
  }

  return {
    whereSql: "WHERE codigo_producto = ?",
    params: nextParams
  };
}

function mapKpiRow(row) {
  return {
    total_eventos: toNumber(row.total_eventos),
    total_piezas_negadas: toNumber(row.total_piezas_negadas),
    total_valor_no_surt_1: toNumber(row.total_valor_no_surt_1),
    total_valor_no_surt_2: toNumber(row.total_valor_no_surt_2),

    eventos_con_existencia_suficiente: toNumber(row.eventos_con_existencia_suficiente),
    piezas_con_existencia_suficiente: toNumber(row.piezas_con_existencia_suficiente),
    valor_1_con_existencia_suficiente: toNumber(row.valor_1_con_existencia_suficiente),
    valor_2_con_existencia_suficiente: toNumber(row.valor_2_con_existencia_suficiente),

    eventos_existencia_parcial: toNumber(row.eventos_existencia_parcial),
    piezas_existencia_parcial: toNumber(row.piezas_existencia_parcial),
    valor_1_existencia_parcial: toNumber(row.valor_1_existencia_parcial),
    valor_2_existencia_parcial: toNumber(row.valor_2_existencia_parcial),

    eventos_sin_existencia: toNumber(row.eventos_sin_existencia),
    piezas_sin_existencia: toNumber(row.piezas_sin_existencia),
    valor_1_sin_existencia: toNumber(row.valor_1_sin_existencia),
    valor_2_sin_existencia: toNumber(row.valor_2_sin_existencia),

    eventos_sin_dato_inventario: toNumber(row.eventos_sin_dato_inventario),
    piezas_sin_dato_inventario: toNumber(row.piezas_sin_dato_inventario),
    valor_1_sin_dato_inventario: toNumber(row.valor_1_sin_dato_inventario),
    valor_2_sin_dato_inventario: toNumber(row.valor_2_sin_dato_inventario),

    productos_distintos: toNumber(row.productos_distintos),
    surtidores_distintos: toNumber(row.surtidores_distintos),
    dias_con_negados: toNumber(row.dias_con_negados),

    registros_sin_fecha: toNumber(row.registros_sin_fecha),
    registros_sin_surtidor: toNumber(row.registros_sin_surtidor),
    registros_sin_inventario: toNumber(row.registros_sin_inventario)
  };
}

router.get("/kpis", (req, res) => {
  try {
    const { whereSql, params } = buildWhere(req.query);

    const row = db
      .prepare(`
        SELECT
          COUNT(*) AS total_eventos,
          COALESCE(SUM(a_deber), 0) AS total_piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS total_valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS total_valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_existencia,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_dato_inventario,

          COUNT(DISTINCT codigo_producto) AS productos_distintos,
          COUNT(DISTINCT CASE WHEN surtidor IS NOT NULL AND surtidor <> 'SIN_SURTIDOR' THEN surtidor END) AS surtidores_distintos,
          COUNT(DISTINCT fecha) AS dias_con_negados,

          SUM(CASE WHEN tiene_fecha = 0 THEN 1 ELSE 0 END) AS registros_sin_fecha,
          SUM(CASE WHEN tiene_surtidor = 0 THEN 1 ELSE 0 END) AS registros_sin_surtidor,
          SUM(CASE WHEN tiene_inventario = 0 THEN 1 ELSE 0 END) AS registros_sin_inventario
        FROM negados
        ${whereSql}
      `)
      .get(...params);

    const data = mapKpiRow(row || {});

    const porcentajeConExistencia =
      data.total_eventos > 0
        ? Number(((data.eventos_con_existencia_suficiente / data.total_eventos) * 100).toFixed(2))
        : 0;

    const porcentajeSinExistencia =
      data.total_eventos > 0
        ? Number(((data.eventos_sin_existencia / data.total_eventos) * 100).toFixed(2))
        : 0;

    return res.json({
      ok: true,
      data: {
        ...data,
        porcentaje_eventos_con_existencia_suficiente: porcentajeConExistencia,
        porcentaje_eventos_sin_existencia: porcentajeSinExistencia
      }
    });
  } catch (error) {
    console.error("Error en KPIs dashboard:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando KPIs del dashboard."
    });
  }
});

router.get("/historico", (req, res) => {
  try {
    const groupBy = req.query.groupBy || "day";

    let groupSelect = "";
    let groupOrder = "";

    if (groupBy === "week") {
      groupSelect = "printf('%04d-S%02d', anio, semana)";
      groupOrder = "anio ASC, semana ASC";
    } else if (groupBy === "month") {
      groupSelect = "printf('%04d-%02d', anio, mes)";
      groupOrder = "anio ASC, mes ASC";
    } else {
      groupSelect = "fecha";
      groupOrder = "fecha ASC";
    }

    const { whereSql, params } = buildWhere(req.query, {
      onlyWithFecha: true
    });

    const data = db
      .prepare(`
        SELECT
          ${groupSelect} AS periodo,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_existencia,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_dato_inventario

        FROM negados
        ${whereSql}
        GROUP BY periodo
        ORDER BY ${groupOrder}
      `)
      .all(...params);

    return res.json({
      ok: true,
      groupBy,
      data
    });
  } catch (error) {
    console.error("Error en histórico dashboard:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando histórico de negados."
    });
  }
});

router.get("/surtidores", (req, res) => {
  try {
    const limit = toInt(req.query.limit, 100);

    const { whereSql, params } = buildWhere(req.query);

    const data = db
      .prepare(`
        SELECT
          surtidor,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,

          COUNT(DISTINCT codigo_producto) AS productos_distintos,
          COUNT(DISTINCT fecha) AS dias_con_negados,

          ROUND(
            CASE
              WHEN COUNT(*) > 0 THEN
                (SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) * 100.0) / COUNT(*)
              ELSE 0
            END,
            2
          ) AS porcentaje_eventos_con_existencia_suficiente

        FROM negados
        ${whereSql}
        GROUP BY surtidor
        ORDER BY eventos_con_existencia_suficiente DESC, eventos DESC
        LIMIT ?
      `)
      .all(...params, limit);

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error("Error en ranking de surtidores:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando ranking por surtidor."
    });
  }
});

router.get("/surtidor/:surtidor/resumen", (req, res) => {
  try {
    const surtidor = String(req.params.surtidor || "").trim();

    if (!surtidor) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar un surtidor válido."
      });
    }

    const query = {
      ...req.query,
      surtidor
    };

    const { whereSql, params } = buildWhere(query);
    const { whereSql: whereFechaSql, params: paramsFecha } = buildWhere(query, {
      onlyWithFecha: true
    });

    const kpisRow = db
      .prepare(`
        SELECT
          COUNT(*) AS total_eventos,
          COALESCE(SUM(a_deber), 0) AS total_piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS total_valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS total_valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_existencia,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,

          COUNT(DISTINCT codigo_producto) AS productos_distintos,
          COUNT(DISTINCT fecha) AS dias_con_negados,

          SUM(CASE WHEN tiene_fecha = 0 THEN 1 ELSE 0 END) AS registros_sin_fecha,
          SUM(CASE WHEN tiene_inventario = 0 THEN 1 ELSE 0 END) AS registros_sin_inventario
        FROM negados
        ${whereSql}
      `)
      .get(...params);

    const kpis = mapKpiRow(kpisRow || {});

    kpis.porcentaje_eventos_con_existencia_suficiente =
      kpis.total_eventos > 0
        ? Number(((kpis.eventos_con_existencia_suficiente / kpis.total_eventos) * 100).toFixed(2))
        : 0;

    kpis.porcentaje_eventos_sin_existencia =
      kpis.total_eventos > 0
        ? Number(((kpis.eventos_sin_existencia / kpis.total_eventos) * 100).toFixed(2))
        : 0;

    const historico = db
      .prepare(`
        SELECT
          fecha AS periodo,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario
        FROM negados
        ${whereFechaSql}
        GROUP BY fecha
        ORDER BY fecha ASC
      `)
      .all(...paramsFecha);

    const productos = db
      .prepare(`
        SELECT
          codigo_producto,
          producto,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,

          COUNT(DISTINCT fecha) AS dias_afectados
        FROM negados
        ${whereSql}
        GROUP BY codigo_producto, producto
        ORDER BY eventos DESC, piezas_negadas DESC
        LIMIT 15
      `)
      .all(...params);

    const productosDia = db
      .prepare(`
        SELECT
          fecha,
          codigo_producto,
          producto,

          COUNT(*) AS veces_negado_en_dia,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas_en_dia,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial
        FROM negados
        ${whereFechaSql}
        GROUP BY fecha, codigo_producto, producto
        ORDER BY veces_negado_en_dia DESC, piezas_negadas_en_dia DESC
        LIMIT 15
      `)
      .all(...paramsFecha);

    const detalle = db
      .prepare(`
        SELECT
          id,
          periodo,
          codigo_producto,
          producto,
          surtidor,
          fecha_texto,
          fecha_hora,
          fecha,
          a_surtir,
          surtido,
          a_deber,
          inventario_anterior,
          inventario_despues_ticket,
          valor_no_surt_1,
          valor_no_surt_2,
          clasificacion
        FROM negados
        ${whereSql}
        ORDER BY
          fecha IS NULL ASC,
          fecha DESC,
          valor_no_surt_1 DESC
        LIMIT 80
      `)
      .all(...params);

    return res.json({
      ok: true,
      data: {
        surtidor,
        kpis,
        historico,
        productos,
        productos_dia: productosDia,
        detalle
      }
    });
  } catch (error) {
    console.error("Error en resumen individual por surtidor:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando resumen individual por surtidor."
    });
  }
});

router.get("/producto/:codigo/resumen", (req, res) => {
  try {
    const codigoProducto = String(req.params.codigo || "").trim();

    if (!codigoProducto) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar un código de producto válido."
      });
    }

    const query = {
      ...req.query
    };

    delete query.producto;

    const baseWhere = buildWhere(query);
    const baseWhereFecha = buildWhere(query, {
      onlyWithFecha: true
    });

    const { whereSql, params } = addCodigoProductoFilter(
      baseWhere.whereSql,
      baseWhere.params,
      codigoProducto
    );

    const { whereSql: whereFechaSql, params: paramsFecha } = addCodigoProductoFilter(
      baseWhereFecha.whereSql,
      baseWhereFecha.params,
      codigoProducto
    );

    const productoInfo = db
      .prepare(`
        SELECT
          codigo_producto,
          producto,
          COUNT(*) AS eventos
        FROM negados
        ${whereSql}
        GROUP BY codigo_producto, producto
        ORDER BY eventos DESC
        LIMIT 1
      `)
      .get(...params);

    const kpisRow = db
      .prepare(`
        SELECT
          COUNT(*) AS total_eventos,
          COALESCE(SUM(a_deber), 0) AS total_piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS total_valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS total_valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_existencia,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_1 ELSE 0 END), 0) AS valor_1_sin_dato_inventario,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN valor_no_surt_2 ELSE 0 END), 0) AS valor_2_sin_dato_inventario,

          COUNT(DISTINCT codigo_producto) AS productos_distintos,
          COUNT(DISTINCT CASE WHEN surtidor IS NOT NULL AND surtidor <> 'SIN_SURTIDOR' THEN surtidor END) AS surtidores_distintos,
          COUNT(DISTINCT fecha) AS dias_con_negados,

          SUM(CASE WHEN tiene_fecha = 0 THEN 1 ELSE 0 END) AS registros_sin_fecha,
          SUM(CASE WHEN tiene_surtidor = 0 THEN 1 ELSE 0 END) AS registros_sin_surtidor,
          SUM(CASE WHEN tiene_inventario = 0 THEN 1 ELSE 0 END) AS registros_sin_inventario
        FROM negados
        ${whereSql}
      `)
      .get(...params);

    const kpis = mapKpiRow(kpisRow || {});

    kpis.porcentaje_eventos_con_existencia_suficiente =
      kpis.total_eventos > 0
        ? Number(((kpis.eventos_con_existencia_suficiente / kpis.total_eventos) * 100).toFixed(2))
        : 0;

    kpis.porcentaje_eventos_sin_existencia =
      kpis.total_eventos > 0
        ? Number(((kpis.eventos_sin_existencia / kpis.total_eventos) * 100).toFixed(2))
        : 0;

    const historico = db
      .prepare(`
        SELECT
          fecha AS periodo,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario
        FROM negados
        ${whereFechaSql}
        GROUP BY fecha
        ORDER BY fecha ASC
      `)
      .all(...paramsFecha);

    const surtidores = db
      .prepare(`
        SELECT
          surtidor,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario,

          COUNT(DISTINCT fecha) AS dias_afectados,

          ROUND(
            CASE
              WHEN COUNT(*) > 0 THEN
                (SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) * 100.0) / COUNT(*)
              ELSE 0
            END,
            2
          ) AS porcentaje_con_existencia
        FROM negados
        ${whereSql}
        GROUP BY surtidor
        ORDER BY eventos DESC, piezas_negadas DESC
      `)
      .all(...params);

    const productosDia = db
      .prepare(`
        SELECT
          fecha,

          COUNT(*) AS veces_negado_en_dia,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas_en_dia,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          COUNT(DISTINCT surtidor) AS surtidores_involucrados,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario
        FROM negados
        ${whereFechaSql}
        GROUP BY fecha
        ORDER BY fecha ASC
      `)
      .all(...paramsFecha);

    const detalle = db
      .prepare(`
        SELECT
          id,
          periodo,
          codigo_producto,
          producto,
          surtidor,
          fecha_texto,
          fecha_hora,
          fecha,
          a_surtir,
          surtido,
          a_deber,
          inventario_anterior,
          inventario_despues_ticket,
          valor_no_surt_1,
          valor_no_surt_2,
          clasificacion
        FROM negados
        ${whereSql}
        ORDER BY
          fecha IS NULL ASC,
          fecha DESC,
          valor_no_surt_1 DESC
        LIMIT 120
      `)
      .all(...params);

    return res.json({
      ok: true,
      data: {
        producto: productoInfo || {
          codigo_producto: codigoProducto,
          producto: "Producto no encontrado"
        },
        kpis,
        historico,
        surtidores,
        productos_dia: productosDia,
        detalle
      }
    });
  } catch (error) {
    console.error("Error en resumen por producto:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando resumen por producto."
    });
  }
});

router.get("/productos", (req, res) => {
  try {
    const limit = toInt(req.query.limit, 100);

    const { whereSql, params } = buildWhere(req.query);

    const data = db
      .prepare(`
        SELECT
          codigo_producto,
          producto,

          COUNT(*) AS eventos,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_con_existencia_suficiente,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN a_deber ELSE 0 END), 0) AS piezas_existencia_parcial,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          COALESCE(SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN a_deber ELSE 0 END), 0) AS piezas_sin_existencia,

          COUNT(DISTINCT surtidor) AS surtidores_involucrados,
          COUNT(DISTINCT fecha) AS dias_afectados,

          ROUND(
            CASE
              WHEN COUNT(*) > 0 THEN
                (SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) * 100.0) / COUNT(*)
              ELSE 0
            END,
            2
          ) AS porcentaje_eventos_con_existencia_suficiente

        FROM negados
        ${whereSql}
        GROUP BY codigo_producto, producto
        ORDER BY eventos DESC, piezas_negadas DESC
        LIMIT ?
      `)
      .all(...params, limit);

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error("Error en ranking de productos:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando ranking por producto."
    });
  }
});

router.get("/productos-dia", (req, res) => {
  try {
    const limit = toInt(req.query.limit, 300);

    const { whereSql, params } = buildWhere(req.query, {
      onlyWithFecha: true
    });

    const data = db
      .prepare(`
        SELECT
          fecha,
          codigo_producto,
          producto,

          COUNT(*) AS veces_negado_en_dia,
          COALESCE(SUM(a_deber), 0) AS piezas_negadas_en_dia,
          COALESCE(SUM(valor_no_surt_1), 0) AS valor_no_surt_1,
          COALESCE(SUM(valor_no_surt_2), 0) AS valor_no_surt_2,

          COUNT(DISTINCT surtidor) AS surtidores_involucrados,

          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.CON_EXISTENCIA_SUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_con_existencia_suficiente,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_EXISTENCIA}' THEN 1 ELSE 0 END) AS eventos_sin_existencia,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.EXISTENCIA_PARCIAL_INSUFICIENTE}' THEN 1 ELSE 0 END) AS eventos_existencia_parcial,
          SUM(CASE WHEN clasificacion = '${CLASIFICACIONES.SIN_DATO_INVENTARIO}' THEN 1 ELSE 0 END) AS eventos_sin_dato_inventario

        FROM negados
        ${whereSql}
        GROUP BY fecha, codigo_producto, producto
        ORDER BY veces_negado_en_dia DESC, piezas_negadas_en_dia DESC, fecha ASC
        LIMIT ?
      `)
      .all(...params, limit);

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error("Error en productos por día:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando productos negados por día."
    });
  }
});

router.get("/detalle", (req, res) => {
  try {
    const limit = Math.min(toInt(req.query.limit, 100), 500);
    const page = toInt(req.query.page, 1);
    const offset = (page - 1) * limit;

    const { whereSql, params } = buildWhere(req.query);

    const totalRow = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM negados
        ${whereSql}
      `)
      .get(...params);

    const data = db
      .prepare(`
        SELECT
          id,
          periodo,
          codigo_producto,
          producto,
          surtidor,
          fecha_texto,
          fecha_hora,
          fecha,
          semana,
          mes,
          anio,
          a_surtir,
          surtido,
          a_deber,
          inventario_anterior,
          inventario_despues_ticket,
          valor_no_surt_1,
          valor_no_surt_2,
          clasificacion,
          tiene_fecha,
          tiene_surtidor,
          tiene_inventario
        FROM negados
        ${whereSql}
        ORDER BY
          fecha IS NULL ASC,
          fecha DESC,
          surtidor ASC,
          producto ASC
        LIMIT ?
        OFFSET ?
      `)
      .all(...params, limit, offset);

    return res.json({
      ok: true,
      pagination: {
        page,
        limit,
        total: toNumber(totalRow?.total),
        total_pages: Math.ceil(toNumber(totalRow?.total) / limit)
      },
      data
    });
  } catch (error) {
    console.error("Error en detalle de negados:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando detalle de negados."
    });
  }
});

router.get("/filtros", (_req, res) => {
  try {
    const periodos = db
      .prepare(`
        SELECT DISTINCT periodo
        FROM negados
        WHERE periodo IS NOT NULL
        ORDER BY periodo DESC
      `)
      .all();

    const surtidores = db
      .prepare(`
        SELECT DISTINCT surtidor
        FROM negados
        WHERE surtidor IS NOT NULL
        ORDER BY surtidor ASC
      `)
      .all();

    const clasificaciones = db
      .prepare(`
        SELECT DISTINCT clasificacion
        FROM negados
        WHERE clasificacion IS NOT NULL
        ORDER BY clasificacion ASC
      `)
      .all();

    return res.json({
      ok: true,
      data: {
        periodos: periodos.map((item) => item.periodo),
        surtidores: surtidores.map((item) => item.surtidor),
        clasificaciones: clasificaciones.map((item) => item.clasificacion)
      }
    });
  } catch (error) {
    console.error("Error consultando filtros:", error);

    return res.status(500).json({
      ok: false,
      message: "Error consultando filtros del dashboard."
    });
  }
});

export default router;