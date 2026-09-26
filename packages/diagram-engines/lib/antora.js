'use strict'

/**
 * Meta / bundle Antora extension.
 *
 * Registers common defaults: Mermaid client (CDN) + diagram-zoom.
 * Authors who want a subset should require the individual packages instead:
 *   - @antora-supplemental/mermaid-client/antora
 *   - @antora-supplemental/diagram-zoom
 *
 * Playbook:
 *   antora:
 *     extensions:
 *       - require: '@antora-supplemental/diagram-engines'
 *         # mermaid: true
 *         # zoom: true
 *         # cdn: 'https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js'
 *         # cdn: false
 *         # localScript: 'js/vendor/mermaid.min.js'
 */

const { truthy } = require('@antora-supplemental/diagram-engines-shared')
const mermaidAntora = require('@antora-supplemental/mermaid-client/antora')
const zoomAntora = require('@antora-supplemental/diagram-zoom')

const PACKAGE = '@antora-supplemental/diagram-engines'

function register (context = {}) {
  const config = context.config || {}
  const logger = this.getLogger(PACKAGE)
  const enableMermaid = truthy(config.mermaid, true)
  const enableZoom = truthy(config.zoom, true)

  if (enableMermaid) {
    const mermaidConfig = {
      injectAssets: truthy(config.injectAssets, true),
      registerAsciidoctor: truthy(config.registerAsciidoctor, true),
    }
    if (Object.prototype.hasOwnProperty.call(config, 'cdn')) mermaidConfig.cdn = config.cdn
    if (config.localScript) mermaidConfig.localScript = config.localScript
    if (config.local) mermaidConfig.local = config.local
    mermaidAntora.call(this, { config: mermaidConfig })
    logger.info('Bundle: mermaid-client enabled')
  }

  if (enableZoom) {
    zoomAntora.call(this, {
      config: { injectAssets: truthy(config.injectAssets, true) },
    })
    logger.info('Bundle: diagram-zoom enabled')
  }

  this.on('playbookBuilt', ({ playbook }) => {
    const keys = playbook.site.keys || (playbook.site.keys = {})
    keys.diagram_engines = 'true'
  })
}

module.exports = register
module.exports.register = register
