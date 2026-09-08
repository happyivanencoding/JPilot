import http from "node:http";

function value(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const listenHost = value("--host", "127.0.0.1");
const listenPort = Number(value("--port", "3003"));
const upstreamHost = "127.0.0.1";
const upstreamPort = 3000;
const upstreamOrigin = `http://${upstreamHost}:${upstreamPort}`;

if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
  throw new Error(`Invalid listen port: ${listenPort}`);
}

function translateSameOriginHeader(rawValue, incomingHost, includePath) {
  if (!rawValue || !incomingHost) return rawValue;
  try {
    const url = new URL(String(rawValue));
    if (url.host.toLowerCase() !== String(incomingHost).toLowerCase()) return rawValue;
    if (!includePath) return upstreamOrigin;
    return `${upstreamOrigin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawValue;
  }
}

const server = http.createServer((req, res) => {
  const incomingHost = req.headers.host;
  const headers = { ...req.headers, host: `${upstreamHost}:${upstreamPort}` };

  if (headers.origin) {
    headers.origin = translateSameOriginHeader(headers.origin, incomingHost, false);
  }
  if (headers.referer) {
    headers.referer = translateSameOriginHeader(headers.referer, incomingHost, true);
  }

  const proxy = http.request(
    {
      hostname: upstreamHost,
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers,
    },
    upstream => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(res);
    },
  );

  proxy.on("error", error => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `JobPilot upstream unavailable: ${error.message}` }));
    } else {
      res.destroy(error);
    }
  });

  req.pipe(proxy);
});

server.requestTimeout = 0;
server.keepAliveTimeout = 65_000;
server.listen(listenPort, listenHost, () => {
  console.log(`JobPilot LAN demo proxy ready on http://${listenHost}:${listenPort} -> ${upstreamOrigin}`);
});
