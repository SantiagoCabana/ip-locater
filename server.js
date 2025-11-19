// server.js
const express = require("express");
const geoip = require("geoip-lite");

const app = express();
const PORT = process.env.PORT || 3000;

// Render / Railway necesitan esto para IP real
app.set("trust proxy", true);

// Fecha/hora ISO 8601 en la zona horaria detectada
function getISODateTime(timezone) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  const hour = parts.find(p => p.type === "hour").value;
  const minute = parts.find(p => p.type === "minute").value;
  const second = parts.find(p => p.type === "second").value;

  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find(p => p.type === "timeZoneName").value;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

// API ÚNICA — super rápida
app.get("/api/location", (req, res) => {
  let ip = req.ip;

  // En localhost usar una IP pública para pruebas
  if (ip === "::1" || ip === "127.0.0.1") {
    ip = "8.8.8.8";
  }

  const geo = geoip.lookup(ip);

  if (!geo) {
    return res.json({ ip, error: "GeoIPNotFound" });
  }

  const timezone = geo.timezone;
  const iso = timezone ? getISODateTime(timezone) : null;

  res.json({
    ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    timezone,
    dateTimeISO: iso
  });
});

// Start server
app.listen(PORT, () => {
  console.log("API escuchando en puerto " + PORT);
});
