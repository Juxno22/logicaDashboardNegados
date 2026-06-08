import express from "express";
import cors from "cors";
import importsRoutes from "./routes/imports.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import "./db.js";

const app = express();

const PORT = process.env.PORT || 4000;

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`API Dashboard Negados en http://localhost:${PORT}`);
});