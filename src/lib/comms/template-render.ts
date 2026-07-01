// Merge-tag renderer for communication templates.
// Pure function: no server-only imports.

import { TAG_REGISTRY, getTagByScopeKey, type TagContext } from './template-tags'

const TAG_RE = /\{([A-Za-z][A-Za-z0-9]*)[.:]([A-Za-z][A-Za-z0-9]*)\}/g

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface TagMapEntry {
  value: string
  isHtml: boolean
}

export function buildTagMap(ctx: TagContext): Map<string, TagMapEntry> {
  const map = new Map<string, TagMapEntry>()
  for (const tag of TAG_REGISTRY) {
    const raw = tag.resolve(ctx)
    map.set(`${tag.scope}.${tag.key}`, { value: raw, isHtml: tag.isHtml })
    map.set(`${tag.scope}:${tag.key}`, { value: raw, isHtml: tag.isHtml })
  }
  return map
}

export function renderTemplate(
  template: string,
  ctx: TagContext,
  mode: 'html' | 'text',
): string {
  const map = buildTagMap(ctx)
  return template.replace(TAG_RE, (match, scope: string, key: string) => {
    const entry = map.get(`${scope}.${key}`) ?? map.get(`${scope}:${key}`)
    if (!entry) return match
    if (mode === 'text') {
      // SMS/plain text should never receive HTML.
      if (entry.isHtml) return ''
      return entry.value
    }
    if (entry.isHtml) return entry.value
    return escHtml(entry.value)
  })
}

export function findUnknownTags(template: string, ctx: TagContext): string[] {
  const map = buildTagMap(ctx)
  const unknown = new Set<string>()
  for (const match of template.matchAll(TAG_RE)) {
    const [, scope, key] = match
    if (!map.has(`${scope}.${key}`) && !map.has(`${scope}:${key}`)) {
      unknown.add(`{${scope}.${key}}`)
    }
  }
  return Array.from(unknown)
}
