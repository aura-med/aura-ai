import { readFile } from 'node:fs/promises'

export async function GET() {
  const spec = await readFile('docs/openapi.yaml', 'utf8')
  return new Response(spec, {
    headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
  })
}

