const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 5500;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function safePath(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  return path.join(ROOT, normalized);
}

function send(res, status, body, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed", "text/plain; charset=utf-8");
  }

  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  } catch {
    return send(res, 400, "Bad Request", "text/plain; charset=utf-8");
  }

  const requestedFile = safePath(pathname);
  const extension = requestedFile ? path.extname(requestedFile).toLowerCase() : "";
  const isAssetRequest = Boolean(extension) && extension !== ".html";

  // Existing files are served normally. Unknown extension-less routes fall back to index.html.
  const shouldServeIndex = !requestedFile || !fs.existsSync(requestedFile) || !fs.statSync(requestedFile).isFile();
  const filePath = shouldServeIndex && !isAssetRequest ? path.join(ROOT, "index.html") : requestedFile;

  fs.readFile(filePath, (error, data) => {
    if (error) {
      return send(res, 404, "Not Found", "text/plain; charset=utf-8");
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    if (req.method !== "HEAD") res.end(data);
    else res.end();
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PulseBoard running at http://127.0.0.1:${PORT}`);
  console.log("SPA fallback enabled: refresh /dashboard, /analytics, /customers, or /settings safely.");
});
