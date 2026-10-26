// 정적 호스팅 흉내(Cloudflare Pages·Caddy try_files와 같은 clean URL): /closet → closet.html, 없으면 404.html(+not-found.html)
//   node scripts/webqa/static-server.mjs <폴더> [포트=8181]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 8181);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".heic": "image/heic", ".json": "application/json", ".ttf": "font/ttf", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
const isFile = (f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile();

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = [p, `${p}.html`, path.join(p, "index.html")].map((c) => path.join(root, c)).find(isFile);
  let status = 200;
  if (!file) {
    status = 404;
    file = ["404.html", "+not-found.html", "index.html"].map((c) => path.join(root, c)).find(isFile);
    if (!file) { res.writeHead(404); res.end("not found"); return; }
  }
  res.writeHead(status, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Cache-Control": file.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`static on ${port}: ${root}`));
