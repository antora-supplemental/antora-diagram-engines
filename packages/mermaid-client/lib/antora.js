'use strict'

/**
 * Antora extension: register mermaid-client Asciidoctor part + inject UI.
 *
 * Config (playbook):
 *   - require: '@antora-supplemental/mermaid-client/antora'
 *     cdn: 'https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js'  # default
 *     # cdn: false
 *     # localScript: 'js/vendor/mermaid.min.js'  # uiRootPath-relative when cdn false
 *     injectAssets: true
 *     registerAsciidoctor: true
 *
 * CDN is first-class: browsers cache Mermaid across sites. Set cdn: false and
 * point localScript at a hub-vendored file for air-gapped builds (do not ship
 * Mermaid inside this package by default).
 */

const path = require('node:path')
const {
  truthy,
  ensureAsciidocExtension,
  ensureAttributes,
  addUiAssets,
  escapeHtml,
} = require('@antora-supplemental/diagram-engines-shared')

const PACKAGE = '@antora-supplemental/mermaid-client'
const DEFAULT_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js'
const UI_ROOT = path.join(__dirname, '..', 'ui')
const ASSETS = [
  { rel: 'js/site-mermaid.js', type: 'asset' },
  { rel: 'css/site-mermaid.css', type: 'asset' },
  { rel: 'partials/mermaid-client-styles.hbs', type: 'partial' },
  { rel: 'partials/mermaid-client-scripts.hbs', type: 'partial' },
]

function resolveCdnConfig (config) {
  if (config.cdn === false || config.cdn === 'false' || config.cdn === 'off' || config.cdn === 'local') {
    return {
      mode: 'local',
      url: '',
      localScript: config.localScript || config.local || 'js/vendor/mermaid.min.js',
    }
  }
  if (typeof config.cdn === 'string' && config.cdn.trim()) {
    return { mode: 'cdn', url: config.cdn.trim(), localScript: '' }
  }
  return { mode: 'cdn', url: DEFAULT_CDN, localScript: '' }
}

function buildConfigPartial (cdn) {
  const payload = {
    mode: cdn.mode,
    cdn: cdn.url || null,
    localScript: cdn.localScript || null,
  }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return (
    `<script type="application/json" id="adt-mermaid-config">${json}</script>\n` +
    `<script>window.__ADT_MERMAID__=Object.assign({},window.__ADT_MERMAID__||{},${json});</script>\n`
  )
}

function register (context) {
  const config = (context && context.config) || {}
  const injectAssets = truthy(config.injectAssets, true)
  const registerAsciidoctor = truthy(config.registerAsciidoctor, true)
  const cdn = resolveCdnConfig(config)
  const logger = this.getLogger(PACKAGE)

  this.on('playbookBuilt', ({ playbook }) => {
    if (registerAsciidoctor) {
      let resolved
      try {
        resolved = require.resolve('./asciidoctor')
      } catch (err) {
        logger.warn(`Unable to resolve Asciidoctor entry: ${err.message}`)
        resolved = null
      }
      if (resolved) {
        ensureAsciidocExtension(
          playbook,
          resolved,
          [
            '@antora-supplemental/mermaid-client',
            '@antora-supplemental/mermaid-client/asciidoctor',
          ],
          logger
        )
      }
    }
    ensureAttributes(playbook, {
      'mermaid-client': '',
      'mermaid-client-mode': 'client',
      'diagram-engines-mermaid': 'client',
      'mermaid-client-cdn': cdn.mode === 'cdn' ? cdn.url : 'local',
    })
    const keys = playbook.site.keys || (playbook.site.keys = {})
    keys.mermaid_client = 'true'
    keys.mermaid_client_cdn = cdn.mode === 'cdn' ? cdn.url : 'local'
    if (cdn.localScript) keys.mermaid_client_local = cdn.localScript
  })

  if (injectAssets) {
    this.on('uiLoaded', ({ uiCatalog }) => {
      addUiAssets(uiCatalog, UI_ROOT, ASSETS, logger)
      // Inject runtime config partial contents as a tiny asset hubs can include,
      // and also as head snippet file for supplemental copy workflows.
      const configHtml = buildConfigPartial(cdn)
      try {
        uiCatalog.addFile({
          contents: Buffer.from(configHtml, 'utf8'),
          type: 'partial',
          path: 'partials/mermaid-client-config.hbs',
        })
      } catch (err) {
        const msg = err.message || ''
        if (/duplicate ui file/i.test(msg)) {
          if (logger.debug) logger.debug(`Skipping duplicate mermaid-client-config partial`)
        } else {
          logger.warn(`Could not add mermaid-client-config partial: ${msg}`)
        }
      }
    })
  }
}

module.exports = register
module.exports.register = register
module.exports._internal = {
  PACKAGE,
  DEFAULT_CDN,
  resolveCdnConfig,
  buildConfigPartial,
  ASSETS,
  UI_ROOT,
}
