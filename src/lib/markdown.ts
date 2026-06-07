/**
 * Basic markdown renderer for journal entries.
 * Handles: **bold**, *italic*, `code`, headings, lists, blockquotes, horizontal rules.
 * No external dependencies.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineMarkdown(text: string): string {
  let result = escapeHtml(text)
  // **bold**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // *italic* or _italic_
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
  // `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  return result
}

export function renderMarkdown(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line → paragraph break
    if (line.trim() === '') {
      i++
      continue
    }

    // Horizontal rule: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push('<hr>')
      i++
      continue
    }

    // Heading: # ... ### ...
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // Blockquote: > ...
    if (line.trimStart().startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(`<blockquote>${inlineMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    // Unordered list: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Ordered list: 1. ...
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i++
      }
      blocks.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^>\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${inlineMarkdown(paraLines.join('\n'))}</p>`)
    }
  }

  return blocks.join('\n')
}
