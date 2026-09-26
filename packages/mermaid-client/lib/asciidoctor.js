'use strict'

/**
 * Asciidoctor extension: Mermaid as client-render hosts.
 * Source stays in HTML for CDN runtime + light/dark re-theme.
 * PlantUML / other Kroki formats are left alone.
 *
 * Attributes:
 * - mermaid-client: '' (enable) | false | off
 * - mermaid-client-mode: client (default) | kroki | off
 * - diagram-engines-mermaid: alias of mermaid-client-mode (compat)
 */

const { docAttr, escapeHtml } = require('@antora-supplemental/diagram-engines-shared')

const PACKAGE = '@antora-supplemental/mermaid-client'
const VERSION = '0.1.0'
const MERMAID_LANGS = new Set(['mermaid'])
const CLIENT_ROLES = new Set(['mermaid-client', 'adt-mermaid-client'])

function isEnabled (doc) {
  if (doc.hasAttribute && doc.hasAttribute('mermaid-client')) {
    const raw = docAttr(doc, 'mermaid-client').toLowerCase()
    if (raw === 'false' || raw === 'off' || raw === '0' || raw === 'disabled') return false
    return true
  }
  if (doc.hasAttribute && doc.hasAttribute('diagram-engines')) {
    const raw = docAttr(doc, 'diagram-engines').toLowerCase()
    if (raw === 'false' || raw === 'off' || raw === '0' || raw === 'disabled') return false
    return true
  }
  const mode = (
    docAttr(doc, 'mermaid-client-mode') ||
    docAttr(doc, 'diagram-engines-mermaid')
  ).toLowerCase()
  return Boolean(mode)
}

function mermaidMode (doc) {
  const mode = (
    docAttr(doc, 'mermaid-client-mode') ||
    docAttr(doc, 'diagram-engines-mermaid') ||
    'client'
  ).toLowerCase()
  if (mode === 'off' || mode === 'false') return 'off'
  if (mode === 'kroki' || mode === 'bake') return 'kroki'
  return 'client'
}

function blockRoles (block) {
  const roles = []
  if (typeof block.getRoles === 'function') {
    for (const r of block.getRoles() || []) roles.push(String(r))
  }
  const roleAttr = block.getAttribute && block.getAttribute('role')
  if (roleAttr) {
    for (const r of String(roleAttr).split(/\s+/)) {
      if (r && !roles.includes(r)) roles.push(r)
    }
  }
  return roles
}

function hasClientRole (block) {
  return blockRoles(block).some((r) => CLIENT_ROLES.has(r))
}

function listingLanguage (block) {
  const style = typeof block.getStyle === 'function' ? block.getStyle() : ''
  if (style && MERMAID_LANGS.has(String(style).toLowerCase())) return String(style).toLowerCase()
  const lang =
    (block.getAttribute && (block.getAttribute('language') || block.getAttribute('lang'))) || ''
  return String(lang).toLowerCase()
}

function isMermaidListing (block) {
  if (!block || (typeof block.getContext === 'function' && block.getContext() !== 'listing')) {
    return false
  }
  if (hasClientRole(block)) return true
  return MERMAID_LANGS.has(listingLanguage(block))
}

function sourceText (block) {
  if (typeof block.getSource === 'function') return block.getSource() || ''
  if (typeof block.getContent === 'function') return block.getContent() || ''
  return ''
}

function titleHtml (block) {
  if (typeof block.getTitle !== 'function') return ''
  const title = block.getTitle()
  if (!title) return ''
  return `<div class="title">${escapeHtml(title)}</div>`
}

function buildClientHostHtml (block, source) {
  const id = typeof block.getId === 'function' && block.getId() ? ` id="${escapeHtml(block.getId())}"` : ''
  const roles = ['listingblock', 'mermaid-client', 'adt-mermaid-client']
  for (const r of blockRoles(block)) {
    if (!roles.includes(r) && r !== 'language-mermaid') roles.push(r)
  }
  const safe = escapeHtml(source.replace(/\r\n/g, '\n').replace(/\s+$/, ''))
  return (
    `<div${id} class="${roles.join(' ')}">` +
    `${titleHtml(block)}` +
    `<div class="content">` +
    `<pre class="mermaid mermaid-source" data-diagram-engine="mermaid">${safe}</pre>` +
    `</div>` +
    `</div>`
  )
}

function replaceWithPass (self, parent, block, html) {
  const pass = self.createBlock(parent, 'pass', html, {})
  const blocks = parent.getBlocks()
  const idx = blocks.indexOf(block)
  if (idx >= 0) blocks.splice(idx, 1, pass)
  else parent.append(pass)
}

function walk (self, parent, mode) {
  const blocks = parent.getBlocks ? parent.getBlocks() : []
  for (const block of [...blocks]) {
    if (!block) continue
    if (isMermaidListing(block)) {
      const lang = listingLanguage(block)
      const clientRole = hasClientRole(block)
      const take = clientRole || (mode === 'client' && MERMAID_LANGS.has(lang))
      if (take) {
        replaceWithPass(self, parent, block, buildClientHostHtml(block, sourceText(block)))
        continue
      }
    }
    if (typeof block.getBlocks === 'function' && block.getBlocks().length) {
      walk(self, block, mode)
    }
  }
}

function registerTreeProcessor (registry) {
  registry.treeProcessor(function () {
    const self = this
    self.process(function (doc) {
      if (!isEnabled(doc)) return
      const mode = mermaidMode(doc)
      if (mode === 'off') return
      walk(self, doc, mode)
      if (!docAttr(doc, 'mermaid-client-version')) {
        doc.setAttribute('mermaid-client-version', VERSION)
      }
    })
  })
}

function register (registry, _context) {
  registerTreeProcessor(registry)
}

module.exports = register
module.exports.register = register
module.exports._internal = {
  PACKAGE,
  VERSION,
  isEnabled,
  mermaidMode,
  escapeHtml,
  isMermaidListing,
  hasClientRole,
  listingLanguage,
  buildClientHostHtml,
  MERMAID_LANGS,
  CLIENT_ROLES,
}
