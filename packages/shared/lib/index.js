'use strict'

const fs = require('node:fs')
const path = require('node:path')

function truthy (v, defaultValue = true) {
  if (v == null) return defaultValue
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  if (s === '' || s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
  return Boolean(s)
}

function docAttr (doc, name) {
  if (!doc || typeof doc.getAttribute !== 'function') return ''
  const v = doc.getAttribute(name)
  if (v == null || v === false) return ''
  return String(v).trim()
}

function escapeHtml (text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ensureAsciidocExtension (playbook, resolvedPath, aliases = [], logger = console) {
  const asciidoc = playbook.asciidoc || (playbook.asciidoc = {})
  const extensions = asciidoc.extensions || (asciidoc.extensions = [])

  const matches = (entry) => {
    if (entry === resolvedPath) return true
    const req = typeof entry === 'string' ? entry : entry && (entry.require || entry)
    if (typeof req !== 'string') return false
    if (aliases.includes(req)) return true
    try {
      return require.resolve(req) === resolvedPath
    } catch (_) {
      return aliases.some((a) => req === a || req.endsWith(a) || req.includes(a))
    }
  }

  if (extensions.some(matches)) return false
  extensions.push(resolvedPath)
  if (logger && logger.info) logger.info(`Registered Asciidoctor extension ${aliases[0] || resolvedPath}`)
  return true
}

function ensureAttributes (playbook, defaults = {}) {
  const asciidoc = playbook.asciidoc || (playbook.asciidoc = {})
  const attributes = asciidoc.attributes || (asciidoc.attributes = {})
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(attributes, key)) {
      attributes[key] = value
    }
  }
  return attributes
}

function normalizeRel (rel) {
  return String(rel).replace(/\\/g, '/')
}

function addUiAssets (uiCatalog, uiRoot, assets, logger = console) {
  let added = 0
  for (const asset of assets) {
    const abs = path.join(uiRoot, asset.rel)
    if (!fs.existsSync(abs)) {
      if (logger.warn) logger.warn(`Missing UI asset: ${asset.rel}`)
      continue
    }
    const contents = fs.readFileSync(abs)
    const type = asset.type || (asset.rel.startsWith('partials/') ? 'partial' : 'asset')
    const rel = normalizeRel(asset.rel)
    const basename = path.posix.basename(rel)
    const stem = basename.replace(/\.[^.]+$/, '')
    const dirname = path.posix.dirname(rel)
    // Antora page-composer registers partials by Vinyl `stem`; plain objects need it set.
    const out =
      type === 'partial'
        ? undefined
        : { path: path.posix.join('_', dirname === '.' ? '' : dirname, basename).replace(/\/+/g, '/') }
    const file = {
      contents,
      type,
      path: rel,
      stem,
      basename,
      ...(out ? { out } : {}),
      stat: fs.statSync(abs),
    }
    try {
      uiCatalog.addFile(file)
      added += 1
    } catch (err) {
      const msg = err.message || ''
      if (/duplicate ui file/i.test(msg)) {
        // Surface double-registration (e.g. hub supplemental-ui mirror + injectAssets).
        // Genuine injectAssets:false skips uiLoaded entirely — do not quiet real conflicts.
        if (logger.warn) {
          logger.warn(
            `Duplicate UI asset ${asset.rel} already in catalog (hub supplemental-ui mirror vs extension inject?). Prefer one owner.`
          )
        }
        continue
      }
      if (logger.warn) logger.warn(`Failed to add UI asset ${asset.rel}: ${msg}`)
    }
  }
  if (added && logger.info) {
    logger.info(`Injected ${added} UI asset(s) from ${path.basename(path.dirname(uiRoot)) || 'package'}`)
  }
  return added
}

module.exports = {
  truthy,
  docAttr,
  escapeHtml,
  ensureAsciidocExtension,
  ensureAttributes,
  addUiAssets,
  normalizeRel,
}
