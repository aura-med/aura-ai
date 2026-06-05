import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { GET as getSwaggerDocs } from '../../app/api/docs/route.ts'

test('Swagger docs endpoint returns 200', async () => {
  const response = await getSwaggerDocs()

  assert.equal(response.status, 200)
  assert.match(await response.text(), /SwaggerUIBundle/)
})

test('OpenAPI document includes bearer auth and issue 59 endpoints', async () => {
  const spec = await readFile(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8')

  assert.match(spec, /openapi: 3\.1\.0/)
  assert.match(spec, /bearerAuth:/)
  assert.match(spec, /\/api\/auth\/token:/)
  assert.match(spec, /\/api\/athletes:/)
  assert.match(spec, /\/api\/athletes\/\{id\}:/)
  assert.match(spec, /\/api\/athletes\/\{id\}\/score:/)
  assert.match(spec, /\/api\/injuries:/)
  assert.match(spec, /\/api\/protocols:/)
  assert.match(spec, /\/api\/rehab\/\{sessionId\}\/rtp:/)
  assert.match(spec, /\/api\/users:/)
})

