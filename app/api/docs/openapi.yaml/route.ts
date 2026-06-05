import { readFile } from 'node:fs/promises'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const raw = await readFile('docs/openapi.yaml', 'utf8')
  const spec = raw.replace(/^(  - url: ).+$/m, `$1${origin}`)
  return new Response(spec, {
    headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
  })
}

