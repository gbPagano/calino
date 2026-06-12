/**
 * Markdown renderer for journal entries.
 * Uses `react-markdown` (CommonMark + GFM) and avoids `dangerouslySetInnerHTML`.
 */

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { JSX } from 'react'

export interface MarkdownProps {
  text: string
  className?: string
}

export function MarkdownView({ text, className }: MarkdownProps): JSX.Element {
  return (
    <div className={className}>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  )
}
