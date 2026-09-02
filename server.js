const express = require("express");
const http = require("http");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 8080;

const STREAMS = {
  "331626":
    "http://s.rocketdns.info:8080/live/LorenaTamayo/5039911146/331626",

  "331627":
    "http://s.rocketdns.info:8080/live/LorenaTamayo/5039911146/331627"
};

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Relink Server",
    streams: Object.keys(STREAMS)
  });
});

app.get("/health", (req, res) => {
  res.type("text/plain").send("OK");
});

/*
=========================================================
SUPPORT BOTH:

/live/LorenaTamayo/5039911146/331626
/live/LorenaTamayo/5039911146/331626.ts

/live/LorenaTamayo/5039911146/331627
/live/LorenaTamayo/5039911146/331627.ts
=========================================================
*/

app.get(
  "/live/:username/:password/:channel",
  relay
);

app.get(
  "/live/:username/:password/:channel.ts",
  relay
);

function relay(req, res) {
  const {
    username,
    password
  } = req.params;

  /*
  Remove .ts if present.
  */
  const channel = req.params.channel.replace(
    /\.ts$/i,
    ""
  );

  /*
  Validate credentials.
  */
  if (
    username !== "LorenaTamayo" ||
    password !== "5039911146"
  ) {
    return res.status(403).json({
      error: "Invalid stream credentials"
    });
  }

  /*
  Find upstream stream.
  */
  const upstream = STREAMS[channel];

  if (!upstream) {
    return res.status(404).json({
      error: "Stream not found",
      channel
    });
  }

  try {
    const target = new URL(upstream);

    const protocol =
      target.protocol === "https:"
        ? https
        : http;

    const options = {
      hostname: target.hostname,

      port:
        target.port ||
        (target.protocol === "https:" ? 443 : 80),

      path:
        target.pathname +
        target.search,

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
        options,
        upstreamResponse => {

          /*
          Forward useful headers.
          */
          const headers = [
            "content-type",
            "content-length",
            "cache-control",
            "expires",
            "etag",
            "last-modified"
          ];

          headers.forEach(header => {
            const value =
              upstreamResponse.headers[header];

            if (value) {
              res.setHeader(header, value);
            }
          });

          /*
          TS segment response.
          */
          if (!res.getHeader("Content-Type")) {
            res.setHeader(
              "Content-Type",
              "video/mp2t"
            );
          }

          res.statusCode =
            upstreamResponse.statusCode || 200;

          /*
          Stream directly to client.
          */
          upstreamResponse.pipe(res);

          /*
          Client disconnected.
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
          error: "Upstream connection failed"
        });
      } else {
        res.end();
      }
    });

    upstreamRequest.end();

    req.on("close", () => {
      upstreamRequest.destroy();
    });

  } catch (error) {
    console.error(
      "Relay error:",
      error.message
    );

    if (!res.headersSent) {
      res.status(500).json({
        error: "Relay error"
      });
    }
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Relink server running on port ${PORT}`
  );

  console.log(
    `331626: /live/LorenaTamayo/5039911146/331626.ts`
  );

  console.log(
    `331627: /live/LorenaTamayo/5039911146/331627.ts`
  );
});
