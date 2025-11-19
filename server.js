// server.js
const express = require("express");
const geoip = require("geoip-lite");

const app = express();
const PORT = process.env.PORT || 3000;

// Para que en Render / proxies te dé la IP real del cliente
app.set("trust proxy", true);

// CORS minimalista y rápido
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // o pon tu dominio en vez de *
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Convierte "GMT-5" / "UTC+3" a "-05:00" / "+03:00"
function toOffsetISO(tzName) {
  if (!tzName) return "+00:00";

  if (tzName === "UTC" || tzName === "GMT") return "+00:00";

  const m = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+00:00";

  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;

  const sign = hours >= 0 ? "+" : "-";
  hours = Math.abs(hours);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  return `${sign}${hh}:${mm}`;
}

// Fecha/hora ISO 8601 en la zona horaria detectada (ej: 2025-11-19T10:35:49-05:00)
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

  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset"
  }).formatToParts(now);

  const tzName = offsetParts.find(p => p.type === "timeZoneName").value; // ej: "GMT-5"
  const offsetISO = toOffsetISO(tzName); // ej: "-05:00"

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetISO}`;
}

// API ÚNICA
app.get("/api/location", (req, res) => {
  let ip = req.ip;

  // En desarrollo local, usa una IP pública para pruebas
  if (ip === "::1" || ip === "127.0.0.1") {
    ip = "8.8.8.8";
  }

  const geo = geoip.lookup(ip);

  if (!geo) {
    return res.json({
      ip,
      error: "GeoIPNotFound"
    });
  }

  const timezone = geo.timezone;
  const dateTimeISO = timezone ? getISODateTime(timezone) : null;

  res.json({
    ip,
    country: geo.country, // código ISO (PE, MX, ES, etc.)
    region: geo.region,   // código región (LIM, M, etc.)
    city: geo.city,
    timezone,
    dateTimeISO
  });
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log("API escuchando en puerto " + PORT);
});
