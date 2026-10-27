// Disposable UI fixture, bound to loopback only. Never deploy this server.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  createHandler,
  VERSION,
  hash,
} from "../supabase/functions/pre-diagnostico/core.mjs";
const root = path.resolve("public"),
  token = "f".repeat(64);
let latest = {},
  count = 0;
const handler = createHandler({
  load: async (h) =>
    h === (await hash(token))
      ? { nome: "Pessoa Teste", version: VERSION, answers: latest }
      : null,
  submit: async (data) => {
    latest = data.p_answers;
    count++;
    return {
      status: "created",
      id: data.p_submission_id,
      created_at: new Date().toISOString(),
    };
  },
  admin: async () => false,
});
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:8768");
      if (url.pathname === "/config.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(
          "window.CLUB_CONFIG={supabaseUrl:location.origin,supabaseAnonKey:'fixture-only'}",
        );
        return;
      }
      if (url.pathname === "/functions/v1/pre-diagnostico") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const r = await handler(
          new Request(url, {
            method: "POST",
            headers: { origin: "https://oftalmoblack.com.br" },
            body: Buffer.concat(chunks),
          }),
        );
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      if (url.pathname === "/fixture-status") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ count, latest }));
        return;
      }
      let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep)) throw Error();
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      res.setHeader(
        "content-type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".woff2": "font/woff2",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(8768, "127.0.0.1", () =>
    console.log(
      "Local fixture: http://127.0.0.1:8768/pre-diagnostico/#t=" + token,
    ),
  );
