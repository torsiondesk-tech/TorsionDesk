'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Imperative handle ──────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  setContent: (html: string) => void
  clearContent: () => void
  getHTML: () => string
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
}

// ── Toolbar button ─────────────────────────────────────────────────────────────

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={cn(
        'inline-flex items-center justify-center rounded p-1.5 transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
}

// ── Component ──────────────────────────────────────────────────────────────────

const TIPTAP_EXTENSIONS = [
  StarterKit,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
]

export const RichTextEditor = React.forwardRef<RichTextEditorHandle, Props>(
  ({ value = '', onChange, minHeight = '180px', className }, ref) => {
    const editor = useEditor({
      extensions: TIPTAP_EXTENSIONS,
      content: value,
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
      editorProps: {
        attributes: {
          class: 'outline-none',
          style: `min-height: ${minHeight}; padding: 0.75rem; font-size: 0.875rem; line-height: 1.6;`,
        },
      },
    })

    React.useImperativeHandle(ref, () => ({
      setContent: (html: string) => editor?.commands.setContent(html ?? ''),
      clearContent: () => editor?.commands.clearContent(),
      getHTML: () => editor?.getHTML() ?? '',
    }))

    const isActive = (name: string, attrs?: Record<string, unknown>) =>
      editor?.isActive(name, attrs) ?? false

    const isAlignActive = (align: string) =>
      (editor?.isActive('paragraph', { textAlign: align }) ||
        editor?.isActive('heading', { textAlign: align })) ??
      false

    function handleLinkToggle() {
      if (!editor) return
      if (isActive('link')) {
        editor.chain().focus().unsetLink().run()
        return
      }
      const url = window.prompt('Enter URL:')
      if (url) editor.chain().focus().setLink({ href: url }).run()
    }

    return (
      <div className={cn('rounded-md border overflow-hidden', className)}>
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
          {/* Heading / Paragraph */}
          <Btn
            onClick={() => editor?.chain().focus().setParagraph().run()}
            active={isActive('paragraph')}
            title="Normal text"
          >
            <span className="text-[11px] font-medium w-5 text-center">P</span>
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            active={isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <span className="text-[11px] font-bold w-5 text-center">H1</span>
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="text-[11px] font-bold w-5 text-center">H2</span>
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            active={isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <span className="text-[11px] font-bold w-5 text-center">H3</span>
          </Btn>

          <Sep />

          {/* Inline formatting */}
          <Btn
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="size-3.5" />
          </Btn>

          <Sep />

          {/* Lists */}
          <Btn
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={isActive('bulletList')}
            title="Bullet list"
          >
            <List className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={isActive('orderedList')}
            title="Numbered list"
          >
            <ListOrdered className="size-3.5" />
          </Btn>

          <Sep />

          {/* Alignment */}
          <Btn
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            active={isAlignActive('left')}
            title="Align left"
          >
            <AlignLeft className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            active={isAlignActive('center')}
            title="Align center"
          >
            <AlignCenter className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            active={isAlignActive('right')}
            title="Align right"
          >
            <AlignRight className="size-3.5" />
          </Btn>

          <Sep />

          {/* Link */}
          <Btn onClick={handleLinkToggle} active={isActive('link')} title="Insert / remove link">
            <LinkIcon className="size-3.5" />
          </Btn>

          <Sep />

          {/* History */}
          <Btn
            onClick={() => editor?.chain().focus().undo().run()}
            active={false}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="size-3.5" />
          </Btn>
          <Btn
            onClick={() => editor?.chain().focus().redo().run()}
            active={false}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="size-3.5" />
          </Btn>
        </div>

        {/* ── Editor area ─────────────────────────────────────────── */}
        <div className="tiptap-content">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  },
)
RichTextEditor.displayName = 'RichTextEditor'
