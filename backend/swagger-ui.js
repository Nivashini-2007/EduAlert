// EduAlert - Swagger UI Middleware & HTML Renderer
const fs = require("fs");
const path = require("path");

const SWAGGER_JSON_PATH = path.join(__dirname, "swagger.json");

function getSwaggerDocument() {
  try {
    return JSON.parse(fs.readFileSync(SWAGGER_JSON_PATH, "utf-8"));
  } catch (err) {
    console.error("[Swagger] Failed to read swagger.json:", err.message);
    return { openapi: "3.0.3", info: { title: "EduAlert API", version: "1.0.0" } };
  }
}

function renderSwaggerUIHtml() {
  const spec = getSwaggerDocument();
  const specJson = JSON.stringify(spec);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EduAlert API - Interactive Swagger Documentation</title>
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.11.0/favicon-32x32.png" sizes="32x32" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body {
      margin: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #3b82f6;
    }
    .custom-header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .custom-header .badge {
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .custom-header a {
      color: #93c5fd;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      margin-left: 16px;
      padding: 6px 12px;
      border: 1px solid #334155;
      border-radius: 8px;
      transition: all .2s;
    }
    .custom-header a:hover {
      background: #1e293b;
      color: #fff;
      border-color: #60a5fa;
    }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 24px 0; }
    .swagger-ui .scheme-container { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 16px 0; }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>
      🎓 EduAlert Backend API
      <span class="badge">OpenAPI 3.0</span>
    </h1>
    <div>
      <a href="/api/health" target="_blank">🏥 Health Check</a>
      <a href="/api/docs/swagger.json" target="_blank">📄 Raw JSON Spec</a>
      <a href="http://localhost:5173" target="_blank">🌐 Open Frontend</a>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${specJson};

      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>`;
}

function setupSwagger(app) {
  // Serve raw OpenAPI JSON
  app.get("/api/docs/swagger.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(getSwaggerDocument());
  });

  // Serve Swagger UI HTML
  const swaggerHandler = (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderSwaggerUIHtml());
  };

  app.get("/api-docs", swaggerHandler);
  app.get("/docs", swaggerHandler);
  app.get("/swagger", swaggerHandler);

  console.log("[Swagger] 📖 Swagger UI initialized at: /api-docs, /docs, /swagger");
}

module.exports = {
  setupSwagger,
  getSwaggerDocument,
  renderSwaggerUIHtml
};
