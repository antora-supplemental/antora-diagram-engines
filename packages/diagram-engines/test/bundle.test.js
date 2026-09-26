'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { resolveCdnConfig, DEFAULT_CDN } = require('@antora-supplemental/mermaid-client/antora')._internal

describe('diagram-engines bundle / CDN config', () => {
  it('defaults to pinned jsDelivr CDN', () => {
    const cfg = resolveCdnConfig({})
    assert.equal(cfg.mode, 'cdn')
    assert.equal(cfg.url, DEFAULT_CDN)
    assert.match(cfg.url, /cdn\.jsdelivr\.net\/npm\/mermaid@11/)
  })

  it('supports local / air-gapped mode', () => {
    const cfg = resolveCdnConfig({ cdn: false, localScript: 'js/vendor/mermaid.min.js' })
    assert.equal(cfg.mode, 'local')
    assert.equal(cfg.localScript, 'js/vendor/mermaid.min.js')
  })

  it('allows custom CDN URL', () => {
    const cfg = resolveCdnConfig({ cdn: 'https://example.test/mermaid.min.js' })
    assert.equal(cfg.mode, 'cdn')
    assert.equal(cfg.url, 'https://example.test/mermaid.min.js')
  })
})
