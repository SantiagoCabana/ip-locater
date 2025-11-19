// server.js
const express = require("express");
const path = require("path");

// Si usas Node 18+ puedes usar fetch global.
// En Node <18 instala node-fetch: npm install node-fetch
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());

// API: devuelve info de ubicación basada en IP
app.get("/api/location", async (req, res) => {
  try {
    // IP del cliente (simplificada; detrás de proxy usa x-forwarded-for)
    const ipHeader = req.headers["x-forwarded-for"];
    const ip =
      (ipHeader && ipHeader.split(",")[0].trim()) ||
      req.socket.remoteAddress ||
      "";

    // Llamada a ipapi.co con IP
    // Si ip es privada/extraña, ipapi igualmente suele detectar la IP pública
    const url =
      ip && !ip.includes("localhost") && !ip.startsWith("::1")
        ? `https://ipapi.co/${ip}/json/`
        : "https://ipapi.co/json/";

    const resp = await fetchFn(url);
    const data = await resp.json();

    if (data.error) {
      console.error("Error ipapi:", data);
      return res.status(500).json({ error: "ipapi_failed" });
    }

    res.json({
      ip: data.ip,
      country: data.country_name,
      city: data.city,
      timezone: data.timezone, // ej: America/Lima
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "location_failed" });
  }
});

// Página principal con frontend incluido
app.get("/", (req, res) => {
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Detección de zona horaria</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 2rem;
      background: #f5f5f5;
    }
    .card {
      max-width: 480px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 8px 20px rgba(0,0,0,0.06);
    }
    h1 {
      font-size: 1.4rem;
      margin-top: 0;
    }
    button {
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
      margin-right: 0.5rem;
    }
    #btn-reintentar {
      margin-top: 1rem;
    }
    .btn-ok {
      background: #22c55e;
      color: #fff;
    }
    .btn-not {
      background: #ef4444;
      color: #fff;
    }
    .btn-secondary {
      background: #e5e7eb;
    }
    .row {
      margin-bottom: 0.5rem;
    }
    code {
      background: #f3f4f6;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Detección de ubicación y hora local</h1>
    <div id="estado" class="row">Cargando...</div>
    <div id="datos" class="row"></div>

    <div id="acciones" class="row" style="display:none;">
      <button id="btn-si" class="btn-ok">Sí, está bien</button>
      <button id="btn-no" class="btn-not">No, cambiar</button>
    </div>

    <div id="editar" class="row" style="display:none; margin-top:0.5rem;">
      <label>
        Zona horaria (IANA):<br/>
        <input id="input-tz" type="text" style="width:100%; padding:0.4rem; margin-top:0.25rem;" />
      </label>
      <button id="btn-guardar" class="btn-secondary" style="margin-top:0.5rem;">Guardar zona horaria</button>
    </div>

    <button id="btn-reintentar" class="btn-secondary" style="display:none;">Olvidar y detectar de nuevo</button>
  </div>

  <script>
    const LS_KEY = "userLocation";

    function formatearHora(timezone) {
      try {
        const fmt = new Intl.DateTimeFormat("es-ES", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        return fmt.format(new Date());
      } catch (e) {
        console.error("Error formateando fecha/hora:", e);
        return "(no se pudo formatear la hora)";
      }
    }

    function mostrarDatos(data, confirmado) {
      const datosEl = document.getElementById("datos");
      const estadoEl = document.getElementById("estado");
      const accionesEl = document.getElementById("acciones");
      const editarEl = document.getElementById("editar");
      const btnRe = document.getElementById("btn-reintentar");

      const hora = data.timezone ? formatearHora(data.timezone) : "(zona horaria desconocida)";

      datosEl.innerHTML = \`
        <div><strong>IP:</strong> \${data.ip || "?"}</div>
        <div><strong>País:</strong> \${data.country || "?"}</div>
        <div><strong>Ciudad:</strong> \${data.city || "?"}</div>
        <div><strong>Zona horaria:</strong> <code>\${data.timezone || "?"}</code></div>
        <div><strong>Fecha y hora local:</strong> \${hora}</div>
      \`;

      if (confirmado) {
        estadoEl.textContent = "Ubicación confirmada y guardada.";
        accionesEl.style.display = "none";
        editarEl.style.display = "none";
        btnRe.style.display = "inline-block";
      } else {
        estadoEl.textContent = "¿Es correcta esta información?";
        accionesEl.style.display = "block";
        editarEl.style.display = "none";
        btnRe.style.display = "inline-block";
      }
    }

    async function detectarUbicacion() {
      const estadoEl = document.getElementById("estado");
      const accionesEl = document.getElementById("acciones");
      const editarEl = document.getElementById("editar");

      accionesEl.style.display = "none";
      editarEl.style.display = "none";
      estadoEl.textContent = "Detectando ubicación...";

      // 1. Ver si ya tenemos datos en localStorage
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        mostrarDatos(data, true);
        return;
      }

      // 2. Si no, llamar al backend
      try {
        const res = await fetch("/api/location");
        if (!res.ok) throw new Error("Respuesta no ok");
        const data = await res.json();
        // Mostrar y pedir confirmación
        mostrarDatos(data, false);

        // Botones de sí / no
        const btnSi = document.getElementById("btn-si");
        const btnNo = document.getElementById("btn-no");
        const inputTz = document.getElementById("input-tz");
        const btnGuardar = document.getElementById("btn-guardar");

        btnSi.onclick = () => {
          localStorage.setItem(LS_KEY, JSON.stringify(data));
          mostrarDatos(data, true);
        };

        btnNo.onclick = () => {
          document.getElementById("editar").style.display = "block";
          inputTz.value = data.timezone || "";
        };

        btnGuardar.onclick = () => {
          const nuevaTz = inputTz.value.trim();
          if (!nuevaTz) {
            alert("Ingresa una zona horaria válida (ej: America/Lima)");
            return;
          }
          const nuevo = { ...data, timezone: nuevaTz };
          localStorage.setItem(LS_KEY, JSON.stringify(nuevo));
          mostrarDatos(nuevo, true);
        };
      } catch (e) {
        console.error(e);
        estadoEl.textContent = "No se pudo detectar la ubicación.";
      }
    }

    document.getElementById("btn-reintentar").onclick = () => {
      localStorage.removeItem(LS_KEY);
      detectarUbicacion();
    };

    // Ejecutar al cargar
    detectarUbicacion();
  </script>
</body>
</html>`);
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log("Servidor escuchando en puerto " + PORT);
});
