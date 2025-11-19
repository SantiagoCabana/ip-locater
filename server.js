// server.js
const express = require("express");
const geoip = require("geoip-lite");

const app = express();
const PORT = process.env.PORT || 3000;

// Función: fecha/hora ISO 8601 real según timezone
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
    hour12: false,
  }).formatToParts(now);

  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  const hour = parts.find(p => p.type === "hour").value;
  const minute = parts.find(p => p.type === "minute").value;
  const second = parts.find(p => p.type === "second").value;

  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(now);

  const offset = offsetParts.find(p => p.type === "timeZoneName").value;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

// Ruta API única
app.get("/api/location", (req, res) => {
  let ip =
    (req.headers["x-forwarded-for"] &&
      req.headers["x-forwarded-for"].split(",")[0].trim()) ||
    req.socket.remoteAddress;

  // En localhost cambiará ::1 por una IP pública de ejemplo para pruebas
  if (ip === "::1" || ip === "127.0.0.1") {
    ip = "8.8.8.8";
  }

  const geo = geoip.lookup(ip);

  if (!geo) {
    return res.status(500).json({ error: "no_geo_data", ip });
  }

  const timezone = geo.timezone;
  const isoDateTime = timezone ? getISODateTime(timezone) : null;

  res.json({
    ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    timezone,
    dateTimeISO: isoDateTime
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log("API corriendo en puerto " + PORT);
});
