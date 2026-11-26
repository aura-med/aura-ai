export async function GET() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sophi Sports API Docs</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    })
  </script>
</body>
</html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src data: https://validator.swagger.io; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'",
    },
  })
}
