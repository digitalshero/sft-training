import { createServer } from "node:http";
import { createServerAdapter } from "@whatwg-node/server";
import handler from "./dist/server/server.js";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const MIME_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mjs": "application/javascript",
};

const clientDir = join(process.cwd(), "dist", "client");

function serveStatic(req, res) {
  const urlPath = req.url.split("?")[0];
  const filePath = join(clientDir, urlPath);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

const adapter = createServerAdapter((request) =>
  handler.fetch(request, {}, {}),
);
const port = process.env.PORT || 3000;

const server = createServer((req, res) => {
  const served = serveStatic(req, res);
  if (!served) {
    adapter(req, res);
  }
});

server.listen(port, () => {
  console.log(`Frontend server listening on port ${port}`);
});
