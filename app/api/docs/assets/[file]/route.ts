import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Swagger UI is served from our own origin (via swagger-ui-dist) so /api/docs works offline.
const ASSETS: Record<string, string> = {
  'swagger-ui.css': 'text/css; charset=utf-8',
  'swagger-ui-bundle.js': 'text/javascript; charset=utf-8',
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const contentType = ASSETS[file]
  if (!contentType) return new Response('Not found', { status: 404 })

  const body = await readFile(path.join(process.cwd(), 'node_modules/swagger-ui-dist', file))
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
