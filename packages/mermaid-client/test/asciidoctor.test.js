'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  mermaidMode,
  isEnabled,
  escapeHtml,
  buildClientHostHtml,
  VERSION,
} = require('../lib/asciidoctor')._internal

function fakeDoc (attrs = {}) {
  const map = { ...attrs }
  return {
    hasAttribute (name) { return Object.prototype.hasOwnProperty.call(map, name) },
    getAttribute (name) { return map[name] },
    setAttribute (name, value) { map[name] = value },
  }
}

function fakeBlock ({ source = 'flowchart TD\n  A-->B', roles = [], id = '' } = {}) {
  return {
    getSource () { return source },
    getRoles () { return roles },
    getAttribute (name) { return name === 'role' ? roles.join(' ') : undefined },
    getId () { return id },
    getTitle () { return null },
  }
}

describe('mermaid-client asciidoctor helpers', () => {
  it('defaults mode to client', () => {
    assert.equal(mermaidMode(fakeDoc()), 'client')
  })

  it('honors kroki / off modes', () => {
    assert.equal(mermaidMode(fakeDoc({ 'mermaid-client-mode': 'kroki' })), 'kroki')
    assert.equal(mermaidMode(fakeDoc({ 'diagram-engines-mermaid': 'off' })), 'off')
  })

  it('enables when mermaid-client attribute present', () => {
    assert.equal(isEnabled(fakeDoc({ 'mermaid-client': '' })), true)
    assert.equal(isEnabled(fakeDoc({ 'mermaid-client': 'off' })), false)
    assert.equal(isEnabled(fakeDoc()), false)
  })

  it('builds client host HTML with escaped source', () => {
    const html = buildClientHostHtml(fakeBlock({ source: 'A-->B & C' }), 'A-->B & C')
    assert.match(html, /mermaid-client/)
    assert.match(html, /data-diagram-engine="mermaid"/)
    assert.match(html, /A--&gt;B &amp; C/)
    assert.ok(!html.includes('A-->B & C'))
  })

  it('escapeHtml covers entities', () => {
    assert.equal(escapeHtml('<b>"x"'), '&lt;b&gt;&quot;x&quot;')
  })

  it('exposes version', () => {
    assert.equal(VERSION, '0.1.0')
  })
})
