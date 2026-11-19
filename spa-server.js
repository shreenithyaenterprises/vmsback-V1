import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = 3002;

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATIC_DIR = path.join(__dirname, "../dist");

// ?? Proxy all API requests to the backend
app.use(
  "/api",
  createProxyMiddleware({
    target: process.env.API_TARGET || "http://localhost:5002",
    changeOrigin: true,
  })
);

app.use(
  "/prebooking/public",
  createProxyMiddleware({
    target: process.env.API_TARGET || "http://localhost:5002",
    changeOrigin: true,
  })
);

// Serve React build
app.use(express.static(STATIC_DIR));

// SPA fallback
app.get("/*path", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPA server running on port ${PORT}`);
});
