const express = require("express");
const http = require("http");
const https = require("https");

const app = express();

const PORT = process.env.PORT || 8080;

/*
=========================================================
UPSTREAM STREAM CONFIGURATION
=========================================================
*/

const STREAMS = {
  "331626":
    "http://s.rocketdns.info:8080/live/LorenaTamayo/5039911146/331626",

  "331627":
    "http://s.rocketdns.info:8080/live/LorenaTamayo/5039911146/331627"
};

/*
=========================================================
HEALTH CHECK
=========================================================
*/

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Relink Server",
    streams: Object.keys(STREAMS)
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/*
=========================================================
STREAM RELAY
=========================================================
*/

app.get(
  "/live/:username/:password/:channel",
  async (req, res) => {
    const {
      username,
      password,
      channel
    } = req.params;

    /*
    Only allow configured streams.
    */
    const upstream = STREAMS[channel];

    if (!upstream) {
      return res.status(404).json({
        error: "Stream not found"
      });
    }

    /*
    Validate the expected path.
    */
    if (
      username !== "LorenaTamayo" ||
      password !== "5039911146"
    ) {
      return res.status(403).json({
        error: "Invalid stream credentials"
      });
    }

    try {
      const target = new URL(upstream);

      const protocol =
        target.protocol === "https:"
          ? https
          : http;

      const requestOptions = {
        hostname: target.hostname,
        port: target.port || (
          target.protocol === "https:"
            ? 443
            : 80
        ),
        path: target.pathname + target.search,
        method: "GET",
        headers: {
          "User-Agent":
            req.headers["user-agent"] ||
            "Mozilla/5.0",

          "Accept":
            req.headers["accept"] ||
            "*/*",

          "Connection": "keep-alive"
        }
      };

      const upstreamRequest =
        protocol.request(
          requestOptions,
          upstreamResponse => {

            /*
            Copy useful response headers.
            */
            if (upstreamResponse.headers[
              "content-type"
            ]) {
              res.setHeader(
                "Content-Type",
                upstreamResponse.headers[
                  "content-type"
                ]
              );
            }

            if (upstreamResponse.headers[
              "content-length"
            ]) {
              res.setHeader(
                "Content-Length",
                upstreamResponse.headers[
                  "content-length"
                ]
              );
            }

            if (upstreamResponse.headers[
              "cache-control"
            ]) {
              res.setHeader(
                "Cache-Control",
                upstreamResponse.headers[
                  "cache-control"
                ]
              );
            }

            res.statusCode =
              upstreamResponse.statusCode || 200;

            /*
            Pipe upstream stream to client.
            */
            upstreamResponse.pipe(res);

            /*
            Stop upstream request if
            client disconnects.
            */
            req.on("close", () => {
              upstreamResponse.destroy();
            });
          }
        );

      upstreamRequest.on("error", error => {
        console.error(
          "Upstream error:",
          error.message
        );

        if (!res.headersSent) {
          res.status(502).json({
            error: "Unable to connect to upstream"
          });
        } else {
          res.end();
        }
      });

      upstreamRequest.end();

      /*
      Stop request when client disconnects.
      */
      req.on("close", () => {
        upstreamRequest.destroy();
      });

    } catch (error) {
      console.error(error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Relay error"
        });
      }
    }
  }
);

/*
=========================================================
START SERVER
=========================================================
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Relink server running on port ${PORT}`
  );

  console.log(
    `Stream 331626: http://localhost:${PORT}/live/LorenaTamayo/5039911146/331626`
  );

  console.log(
    `Stream 331627: http://localhost:${PORT}/live/LorenaTamayo/5039911146/331627`
  );
});
