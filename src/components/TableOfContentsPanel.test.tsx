import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TableOfContentsPanel } from './TableOfContentsPanel'

type MockBlock = {
  id: string
  type: string
  props?: Record<string, unknown>
  content?: unknown[]
  children?: MockBlock[]
}

function createMockEditor(blocks: MockBlock[]) {
  const listeners: Array<() => void> = []

  return {
    document: blocks,
    forEachBlock(callback: (block: MockBlock) => boolean) {
      const walk = (list: MockBlock[]) => {
        for (const block of list) {
          const cont = callback(block)
          if (cont && block.children) walk(block.children)
        }
      }
      walk(blocks)
    },
    onChange(cb: () => void) {
      listeners.push(cb)
      return () => {
        const idx = listeners.indexOf(cb)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    },
    setTextCursorPosition: vi.fn(),
    focus: vi.fn(),
    _fireChange() {
      for (const cb of listeners) cb()
    },
    _replaceBlocks(next: MockBlock[]) {
      blocks.length = 0
      blocks.push(...next)
    },
  } as unknown as Parameters<typeof TableOfContentsPanel>[0]['editor']
}

function heading(id: string, level: number, text: string, children?: MockBlock[]): MockBlock {
  return {
    id,
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text }],
    children,
  }
}

function paragraph(id: string, text: string): MockBlock {
  return { id, type: 'paragraph', content: [{ type: 'text', text }] }
}

describe('TableOfContentsPanel', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose = vi.fn()
  })

  describe('heading extraction', () => {
    it('extracts H1, H2, and H3 headings', () => {
      const editor = createMockEditor([
        heading('h1', 1, 'Introduction'),
        paragraph('p1', 'some text'),
        heading('h2', 2, 'Background'),
        heading('h3', 3, 'Details'),
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('Introduction')).toBeInTheDocument()
      expect(screen.getByText('Background')).toBeInTheDocument()
      expect(screen.getByText('Details')).toBeInTheDocument()
    })

    it('renders headings with proportional indentation', () => {
      const editor = createMockEditor([
        heading('h1', 1, 'Level 1'),
        heading('h2', 2, 'Level 2'),
        heading('h3', 3, 'Level 3'),
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      const h1Button = screen.getByText('Level 1').closest('button')!
      const h2Button = screen.getByText('Level 2').closest('button')!
      const h3Button = screen.getByText('Level 3').closest('button')!

      expect(h1Button.style.paddingLeft).toBe('8px')
      expect(h2Button.style.paddingLeft).toBe('24px')
      expect(h3Button.style.paddingLeft).toBe('40px')
    })

    it('extracts text from headings containing links', () => {
      const editor = createMockEditor([
        {
          id: 'h1',
          type: 'heading',
          props: { level: 1 },
          content: [
            { type: 'text', text: 'See ' },
            { type: 'link', content: [{ type: 'text', text: 'this page' }] },
            { type: 'text', text: ' for details' },
          ],
        },
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('See this page for details')).toBeInTheDocument()
    })

    it('extracts headings nested inside layout blocks', () => {
      const editor = createMockEditor([
        heading('h1', 1, 'Top Level'),
        {
          id: 'col1',
          type: 'column',
          content: [],
          children: [
            heading('nested-h2', 2, 'Nested Heading'),
          ],
        },
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('Top Level')).toBeInTheDocument()
      expect(screen.getByText('Nested Heading')).toBeInTheDocument()
    })

    it('skips headings with only whitespace text', () => {
      const editor = createMockEditor([
        heading('h1', 1, 'Real Heading'),
        heading('h2', 2, '   '),
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('Real Heading')).toBeInTheDocument()
      const headingButtons = screen.queryAllByRole('button').filter(b => b.textContent?.trim() !== '' && !b.getAttribute('aria-label'))
      expect(headingButtons).toHaveLength(1)
      expect(headingButtons[0].textContent).toBe('Real Heading')
    })
  })

  describe('empty state', () => {
    it('shows empty message when no headings exist', () => {
      const editor = createMockEditor([
        paragraph('p1', 'just a paragraph'),
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('No headings found in this note')).toBeInTheDocument()
    })
  })

  describe('click navigation', () => {
    it('focuses editor and sets cursor position on heading click', () => {
      const editor = createMockEditor([
        heading('h1', 1, 'Click Me'),
      ])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      fireEvent.click(screen.getByText('Click Me'))

      const raw = editor as unknown as { focus: ReturnType<typeof vi.fn>; setTextCursorPosition: ReturnType<typeof vi.fn> }
      expect(raw.focus).toHaveBeenCalled()
      expect(raw.setTextCursorPosition).toHaveBeenCalledWith('h1', 'start')
    })
  })

  describe('live updates', () => {
    it('updates heading list when editor content changes', () => {
      const blocks: MockBlock[] = [heading('h1', 1, 'Original')]
      const editor = createMockEditor(blocks)
      const raw = editor as unknown as { _fireChange: () => void; _replaceBlocks: (b: MockBlock[]) => void }

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('Original')).toBeInTheDocument()

      act(() => {
        raw._replaceBlocks([
          heading('h1', 1, 'Original'),
          heading('h2', 2, 'Added Later'),
        ])
        raw._fireChange()
      })

      expect(screen.getByText('Added Later')).toBeInTheDocument()
    })
  })

  describe('close button', () => {
    it('calls onClose when close button is clicked', () => {
      const editor = createMockEditor([heading('h1', 1, 'Heading')])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      fireEvent.click(screen.getByLabelText('Close table of contents'))

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('panel header', () => {
    it('displays the panel title', () => {
      const editor = createMockEditor([])

      render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      expect(screen.getByText('Table of Contents')).toBeInTheDocument()
    })
  })

  describe('cleanup', () => {
    it('unsubscribes from editor changes on unmount', () => {
      const editor = createMockEditor([heading('h1', 1, 'Test')])
      const raw = editor as unknown as { _fireChange: () => void; _replaceBlocks: (b: MockBlock[]) => void }

      const { unmount } = render(<TableOfContentsPanel editor={editor} onClose={onClose} />)

      unmount()

      // Should not throw after unmount
      raw._replaceBlocks([heading('h1', 1, 'After Unmount')])
      expect(() => { raw._fireChange() }).not.toThrow()
    })
  })
})
