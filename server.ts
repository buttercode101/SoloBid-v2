import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: "local-mock" });
  });

  app.post("/api/send-email", (req, res) => {
    const { to, subject } = req.body || {};
    res.json({
      status: "ok",
      mocked: true,
      message: "Email delivery is simulated in the client-only SoloBid build.",
      to,
      subject,
      sentAt: new Date().toISOString(),
    });
  });

  app.post("/api/send-invoice", (req, res) => {
    const { invoiceId } = req.body || {};
    res.json({
      status: "ok",
      mocked: true,
      invoiceId,
      message: "Invoice delivery is simulated in the client-only SoloBid build.",
      sentAt: new Date().toISOString(),
    });
  });

  app.get("/api/cron/reminders", (_req, res) => {
    res.json({
      status: "ok",
      mocked: true,
      message: "Recurring invoices are processed by the browser cron simulator.",
      processedAt: new Date().toISOString(),
    });
  });

  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  return app;
}

if (process.env.NODE_ENV !== "production") {
  createApp().then((app) => {
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
      console.log(`SoloBid mock server running on http://localhost:${port}`);
    });
  });
}
