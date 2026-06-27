import http from "http";
import https from "https";
import { request } from "http";

const server = http.createServer((req, res) => {
  const options = {
    hostname: "localhost",
    port: 8081,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: "localhost",
    },
  };

  const proxy = request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxy, { end: true });
  proxy.on("error", (err) => {
    res.writeHead(502);
    res.end("Proxy error: " + err.message);
  });
});

server.listen(8082, "0.0.0.0", () => {
  console.log("Proxy running on port 8082");
});