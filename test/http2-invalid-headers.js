'use strict'

const { tspl } = require('@matteo.collina/tspl')
const { test } = require('node:test')
const { createSecureServer } = require('node:http2')
const { once } = require('node:events')
const pem = require('https-pem')

const { Client } = require('..')

test('should handle invalid HTTP/2 headers gracefully', async (t) => {
  const { ok } = tspl(t, { plan: 2 })

  const server = createSecureServer(pem, { allowHTTP1: false })
  server.on('stream', (stream) => {
    // Send an invalid HTTP/2 header
    stream.respond({
      ':status': 200,
      connection: 'keep-alive' // Invalid in HTTP/2
    })
    stream.end()
  })

  server.listen()
  await once(server, 'listening')

  const client = new Client(`https://localhost:${server.address().port}`, {
    connect: { rejectUnauthorized: false },
    allowH2: true
  })

  try {
    await client.request({ path: '/', method: 'GET' })
    ok(false, 'Expected request to fail')
  } catch (err) {
    ok(
      ['UND_ERR_HTTP2_INVALID_HEADER', 'UND_ERR_SOCKET', 'UND_ERR_DESTROYED'].includes(err.code),
      `Expected specific error code, got: ${err.code}`
    )
  } finally {
    await client.close()
    server.close()
    await once(server, 'close')
  }
})
