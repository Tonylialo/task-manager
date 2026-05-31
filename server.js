import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const emptyDb = {
  viewMode: "canvas",
  view: {
    x: 0,
    y: 0,
    scale: 1
  },
  directions: [],
  tasks: [],
  notifications: []
};

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });

  if (!existsSync(dbPath)) {
    await writeFile(dbPath, JSON.stringify(emptyDb, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();

  const raw = await readFile(dbPath, "utf8");
  return JSON.parse(raw);
}

async function writeDb(data) {
  await ensureDb();

  const tmpPath = `${dbPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") pathname = "/index.html";

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  res.writeHead(200, {
    "Content-Type": mime[ext] || "application/octet-stream"
  });

  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/db" && req.method === "GET") {
      const db = await readDb();
      sendJson(res, 200, db);
      return;
    }

    if (req.url === "/api/db" && req.method === "POST") {
      const body = await readRequestBody(req);
      const data = JSON.parse(body);

      await writeDb(data);

      sendJson(res, 200, {
        ok: true
      });

      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Kuro Task Manager running: http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});
