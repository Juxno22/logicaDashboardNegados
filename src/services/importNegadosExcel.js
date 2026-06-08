import xlsx from "xlsx";
import crypto from "crypto";
import db from "../db.js";
import { clasificarNegado } from "./clasificarNegado.js";
import { parseFechaReporte } from "./parseFechaReporte.js";

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const clean = String(value)
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .trim();

  if (!clean || clean === "-") {
    return null;
  }

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : null;
}

function getValue(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }

  return null;
}

function makeHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function inferPeriodo(rows) {
  for (const row of rows) {
    const parsed = parseFechaReporte(row.Fecha);

    if (parsed) {
      return `${parsed.anio}-${String(parsed.mes).padStart(2, "0")}`;
    }
  }

  return "SIN_PERIODO";
}

export function importarNegadosExcel({ filePath, originalName, periodo }) {
  const workbook = xlsx.readFile(filePath);

  const sheetName = "Convertido";

  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`El archivo no contiene la hoja requerida: ${sheetName}`);
  }

  const worksheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false
  });

  if (!rows.length) {
    throw new Error("La hoja Convertido no contiene registros.");
  }

  const periodoFinal = periodo || inferPeriodo(rows);

  const insertImport = db.prepare(`
    INSERT INTO imports_negados (
      periodo,
      archivo_nombre,
      total_registros,
      registros_insertados,
      registros_duplicados,
      total_piezas_negadas,
      total_valor_no_surt_1,
      total_valor_no_surt_2
    )
    VALUES (?, ?, 0, 0, 0, 0, 0, 0)
  `);

  const insertNegado = db.prepare(`
    INSERT OR IGNORE INTO negados (
      import_id,
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
      tiene_inventario,

      row_hash
    )
    VALUES (
      @import_id,
      @periodo,

      @codigo_producto,
      @producto,
      @surtidor,

      @fecha_texto,
      @fecha_hora,
      @fecha,
      @semana,
      @mes,
      @anio,

      @a_surtir,
      @surtido,
      @a_deber,

      @inventario_anterior,
      @inventario_despues_ticket,

      @valor_no_surt_1,
      @valor_no_surt_2,

      @clasificacion,

      @tiene_fecha,
      @tiene_surtidor,
      @tiene_inventario,

      @row_hash
    )
  `);

  const updateImport = db.prepare(`
    UPDATE imports_negados
    SET
      total_registros = ?,
      registros_insertados = ?,
      registros_duplicados = ?,
      total_piezas_negadas = ?,
      total_valor_no_surt_1 = ?,
      total_valor_no_surt_2 = ?
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const importResult = insertImport.run(periodoFinal, originalName);
    const importId = importResult.lastInsertRowid;

    let totalRegistros = 0;
    let insertados = 0;
    let duplicados = 0;
    let totalPiezasNegadas = 0;
    let totalValorNoSurt1 = 0;
    let totalValorNoSurt2 = 0;

    const resumenClasificacion = {};

    for (const row of rows) {
      const codigoProducto = cleanText(getValue(row, ["Id_Producto", "Prod", "Producto ID"]));
      const producto = cleanText(getValue(row, ["Producto", "Desc"]));

      if (!codigoProducto && !producto) {
        continue;
      }

      totalRegistros += 1;

      const surtidorOriginal = cleanText(getValue(row, ["Surtidor", "Surt"]));
      const surtidor = surtidorOriginal && surtidorOriginal !== "-" ? surtidorOriginal : "SIN_SURTIDOR";

      const fechaTexto = cleanText(getValue(row, ["Fecha", "Fecha y Hora R."]));
      const fechaParsed = parseFechaReporte(fechaTexto);

      const aSurtir = toNumber(getValue(row, ["A surtir", "Solic"])) || 0;
      const surtido = toNumber(getValue(row, ["Surtido"])) || 0;
      const aDeber = toNumber(getValue(row, ["A deber", "Negado"])) || 0;

      const inventarioAnterior = toNumber(getValue(row, ["Inventario anterior", "Ex Hoy."]));
      const inventarioDespuesTicket = toNumber(
        getValue(row, [
          "Iinventario despues de Ticket",
          "Inventario despues de Ticket",
          "Inventario después de Ticket",
          "ExSurt"
        ])
      );

      const valorNoSurt1 = toNumber(getValue(row, ["monto", "Val No Surt"])) || 0;
      const valorNoSurt2 = toNumber(getValue(row, ["Unnamed: 10", "Val No Surt_1", "Val No Surt 2"])) || 0;

      const clasificacion = clasificarNegado({
        aSurtir,
        aDeber,
        inventarioAnterior
      });

      const hashPayload = {
        periodo: periodoFinal,
        codigoProducto,
        producto,
        surtidor,
        fechaTexto,
        aSurtir,
        surtido,
        aDeber,
        inventarioAnterior,
        inventarioDespuesTicket,
        valorNoSurt1,
        valorNoSurt2
      };

      const rowHash = makeHash(hashPayload);

      const data = {
        import_id: importId,
        periodo: periodoFinal,

        codigo_producto: codigoProducto || null,
        producto: producto || null,
        surtidor,

        fecha_texto: fechaTexto || null,
        fecha_hora: fechaParsed?.fechaHora || null,
        fecha: fechaParsed?.fecha || null,
        semana: fechaParsed?.semana || null,
        mes: fechaParsed?.mes || null,
        anio: fechaParsed?.anio || null,

        a_surtir: aSurtir,
        surtido,
        a_deber: aDeber,

        inventario_anterior: inventarioAnterior,
        inventario_despues_ticket: inventarioDespuesTicket,

        valor_no_surt_1: valorNoSurt1,
        valor_no_surt_2: valorNoSurt2,

        clasificacion,

        tiene_fecha: fechaParsed ? 1 : 0,
        tiene_surtidor: surtidor === "SIN_SURTIDOR" ? 0 : 1,
        tiene_inventario: inventarioAnterior === null ? 0 : 1,

        row_hash: rowHash
      };

      const result = insertNegado.run(data);

      if (result.changes > 0) {
        insertados += 1;
        totalPiezasNegadas += aDeber;
        totalValorNoSurt1 += valorNoSurt1;
        totalValorNoSurt2 += valorNoSurt2;

        if (!resumenClasificacion[clasificacion]) {
          resumenClasificacion[clasificacion] = {
            eventos: 0,
            piezas: 0,
            valor_no_surt_1: 0,
            valor_no_surt_2: 0
          };
        }

        resumenClasificacion[clasificacion].eventos += 1;
        resumenClasificacion[clasificacion].piezas += aDeber;
        resumenClasificacion[clasificacion].valor_no_surt_1 += valorNoSurt1;
        resumenClasificacion[clasificacion].valor_no_surt_2 += valorNoSurt2;
      } else {
        duplicados += 1;
      }
    }

    updateImport.run(
      totalRegistros,
      insertados,
      duplicados,
      totalPiezasNegadas,
      totalValorNoSurt1,
      totalValorNoSurt2,
      importId
    );

    return {
      import_id: importId,
      periodo: periodoFinal,
      archivo: originalName,
      total_registros: totalRegistros,
      registros_insertados: insertados,
      registros_duplicados: duplicados,
      total_piezas_negadas: totalPiezasNegadas,
      total_valor_no_surt_1: Number(totalValorNoSurt1.toFixed(2)),
      total_valor_no_surt_2: Number(totalValorNoSurt2.toFixed(2)),
      resumen_clasificacion: resumenClasificacion
    };
  });

  return transaction();
}