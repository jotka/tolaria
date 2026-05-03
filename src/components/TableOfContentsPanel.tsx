import { useCallback, useEffect, useState } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import { X, ListBullets } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate, type AppLocale } from '../lib/i18n'

type BlockNoteEditor = ReturnType<typeof useCreateBlockNote>

interface HeadingItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsPanelProps {
  editor: BlockNoteEditor
  onClose: () => void
  locale?: AppLocale
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.reduce((acc: string, node: { type?: string; text?: string; content?: unknown }) => {
    if (node.type === 'text') return acc + (node.text ?? '')
    if (node.type === 'link') return acc + extractText(node.content)
    return acc
  }, '')
}

function extractHeadings(editor: BlockNoteEditor): HeadingItem[] {
  const headings: HeadingItem[] = []
  editor.forEachBlock((block: { id: string; type: string; props: Record<string, unknown>; content: unknown }) => {
    if (block.type === 'heading') {
      const text = extractText(block.content)
      if (text.trim()) {
        headings.push({
          id: block.id,
          text,
          level: (block.props as { level?: number }).level ?? 1,
        })
      }
    }
    return true
  })
  return headings
}

function HeadingEntry({
  heading,
  onClick,
}: {
  heading: HeadingItem
  onClick: () => void
}) {
  const indent = (heading.level - 1) * 16
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      style={{ paddingLeft: indent + 8 }}
      onClick={onClick}
    >
      <span className="truncate">{heading.text}</span>
    </button>
  )
}

export function TableOfContentsPanel({ editor, onClose, locale = 'en' }: TableOfContentsPanelProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>(() => extractHeadings(editor))

  useEffect(() => {
    return editor.onChange(() => {
      setHeadings(extractHeadings(editor))
    })
  }, [editor])

  const handleClick = useCallback(
    (blockId: string) => {
      editor.focus()
      editor.setTextCursorPosition(blockId, 'start')
      const element = document.querySelector(`[data-id="${blockId}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [editor],
  )

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center border-b border-border"
        style={{ padding: '8px 12px', gap: 8 }}
      >
        <ListBullets size={16} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
          {translate(locale, 'toc.title')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={translate(locale, 'toc.close')}
        >
          <X size={14} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: '4px 4px' }}>
        {headings.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {translate(locale, 'toc.empty')}
          </p>
        ) : (
          headings.map((heading) => (
            <HeadingEntry
              key={heading.id}
              heading={heading}
              onClick={() => { handleClick(heading.id) }}
            />
          ))
        )}
      </div>
    </div>
  )
}
