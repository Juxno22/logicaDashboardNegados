CREATE TABLE IF NOT EXISTS imports_negados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo TEXT NOT NULL,
  archivo_nombre TEXT NOT NULL,
  total_registros INTEGER DEFAULT 0,
  registros_insertados INTEGER DEFAULT 0,
  registros_duplicados INTEGER DEFAULT 0,
  total_piezas_negadas REAL DEFAULT 0,
  total_valor_no_surt_1 REAL DEFAULT 0,
  total_valor_no_surt_2 REAL DEFAULT 0,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS negados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  import_id INTEGER NOT NULL,
  periodo TEXT NOT NULL,

  codigo_producto TEXT,
  producto TEXT,
  surtidor TEXT,

  fecha_texto TEXT,
  fecha_hora TEXT,
  fecha TEXT,
  semana INTEGER,
  mes INTEGER,
  anio INTEGER,

  a_surtir REAL DEFAULT 0,
  surtido REAL DEFAULT 0,
  a_deber REAL DEFAULT 0,

  inventario_anterior REAL,
  inventario_despues_ticket REAL,

  valor_no_surt_1 REAL DEFAULT 0,
  valor_no_surt_2 REAL DEFAULT 0,

  clasificacion TEXT NOT NULL,

  tiene_fecha INTEGER DEFAULT 1,
  tiene_surtidor INTEGER DEFAULT 1,
  tiene_inventario INTEGER DEFAULT 1,

  row_hash TEXT NOT NULL UNIQUE,

  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (import_id) REFERENCES imports_negados(id)
);

CREATE INDEX IF NOT EXISTS idx_negados_periodo ON negados(periodo);
CREATE INDEX IF NOT EXISTS idx_negados_fecha ON negados(fecha);
CREATE INDEX IF NOT EXISTS idx_negados_surtidor ON negados(surtidor);
CREATE INDEX IF NOT EXISTS idx_negados_producto ON negados(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_negados_clasificacion ON negados(clasificacion);