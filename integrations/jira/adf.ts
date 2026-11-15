/**
 * Minimal Atlassian Document Format (ADF) helpers.
 * Jira Cloud REST API v3 returns descriptions/comments as ADF JSON, not plain text.
 */
export interface AdfNode {
  type: string;
  version?: number;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** Convert ADF to plain text with one line per block; list items are prefixed with "- ". */
export function adfToText(node: AdfNode | string | null | undefined): string {
  if (!node) return '';
  if (typeof node === 'string') return node; // Jira Server / v2 returns wiki text
  const lines: string[] = [];
  const walk = (n: AdfNode, prefix = ''): void => {
    switch (n.type) {
      case 'text':
        return;
      case 'paragraph':
      case 'heading': {
        const text = inline(n);
        if (text.trim()) lines.push(prefix + text);
        return;
      }
      case 'tableRow':
        lines.push(prefix + '| ' + (n.content ?? []).map((cell) => (cell.content ?? []).map(inline).join(' ')).join(' | ') + ' |');
        return;
      case 'listItem':
        (n.content ?? []).forEach((c, i) => walk(c, i === 0 ? '- ' : '  '));
        return;
      default:
        (n.content ?? []).forEach((c) => walk(c, prefix));
    }
  };
  const inline = (n: AdfNode): string =>
    (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : c.type === 'hardBreak' ? ' ' : inline(c))).join('');
  walk(node);
  return lines.join('\n');
}

// ── Builders for publishing comments ─────────────────────────
export const adf = {
  doc: (...content: AdfNode[]): AdfNode => ({ type: 'doc', version: 1, content }),
  heading: (text: string, level = 3): AdfNode => ({ type: 'heading', attrs: { level }, content: [adf.text(text)] }),
  paragraph: (...content: AdfNode[]): AdfNode => ({ type: 'paragraph', content }),
  text: (text: string, strong = false): AdfNode => ({ type: 'text', text, ...(strong ? { marks: [{ type: 'strong' }] } : {}) }),
  link: (text: string, href: string): AdfNode => ({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }),
  bullets: (items: string[]): AdfNode => ({
    type: 'bulletList',
    content: items.map((t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [adf.text(t)] }] })),
  }),
  ordered: (items: string[]): AdfNode => ({
    type: 'orderedList',
    content: items.map((t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [adf.text(t)] }] })),
  }),
  /** Bullet list whose items are already-built inline nodes (e.g. text + links). */
  richBullets: (items: AdfNode[][]): AdfNode => ({
    type: 'bulletList',
    content: items.map((inline) => ({ type: 'listItem', content: [{ type: 'paragraph', content: inline }] })),
  }),
  panel: (panelType: 'info' | 'note' | 'success' | 'warning' | 'error', ...content: AdfNode[]): AdfNode => ({
    type: 'panel', attrs: { panelType }, content,
  }),
  code: (text: string, language = 'json'): AdfNode => ({ type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text }] }),
  table: (header: string[], rows: string[][]): AdfNode => ({
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: [
      { type: 'tableRow', content: header.map((h) => ({ type: 'tableHeader', content: [adf.paragraph(adf.text(h, true))] })) },
      ...rows.map((r) => ({ type: 'tableRow', content: r.map((c) => ({ type: 'tableCell', content: [adf.paragraph(adf.text(c || '-'))] })) })),
    ],
  }),
};
