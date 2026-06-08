import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db.js";
import { importarNegadosExcel } from "../services/importNegadosExcel.js";

const router = express.Router();

const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-() ]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (![".xlsx", ".xls"].includes(ext)) {
      return cb(new Error("Solo se permiten archivos Excel .xlsx o .xls"));
    }

    cb(null, true);
  }
});

router.post("/negados", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar un archivo en el campo file."
      });
    }

    const resultado = importarNegadosExcel({
      filePath: req.file.path,
      originalName: req.file.originalname,
      periodo: req.body.periodo || null
    });

    return res.json({
      ok: true,
      message: "Reporte de negados importado correctamente.",
      data: resultado
    });
  } catch (error) {
    console.error("Error importando negados:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error importando reporte de negados."
    });
  }
});

router.get("/negados", (_req, res) => {
  const imports = db
    .prepare(`
      SELECT
        id,
        periodo,
        archivo_nombre,
        total_registros,
        registros_insertados,
        registros_duplicados,
        total_piezas_negadas,
        total_valor_no_surt_1,
        total_valor_no_surt_2,
        creado_en
      FROM imports_negados
      ORDER BY creado_en DESC
    `)
    .all();

  return res.json({
    ok: true,
    data: imports
  });
});

router.get("/negados/:id/resumen", (req, res) => {
  const importId = Number(req.params.id);

  const resumen = db
    .prepare(`
      SELECT
        clasificacion,
        COUNT(*) AS eventos,
        SUM(a_deber) AS piezas_negadas,
        SUM(valor_no_surt_1) AS valor_no_surt_1,
        SUM(valor_no_surt_2) AS valor_no_surt_2
      FROM negados
      WHERE import_id = ?
      GROUP BY clasificacion
      ORDER BY eventos DESC
    `)
    .all(importId);

  return res.json({
    ok: true,
    data: resumen
  });
});

export default router;