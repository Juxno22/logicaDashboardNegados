import express from "express";
import cors from "cors";
import importsRoutes from "./routes/imports.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import "./db.js";

const app = express();

const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "API Dashboard Negados funcionando correctamente."
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "negados-backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/imports", importsRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API Dashboard Negados en puerto ${PORT}`);
});