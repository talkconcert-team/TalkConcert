import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List } from 'lucide-react'

// 입력 화면에서는 서식을 직접 편집하고, 저장할 때만 기존 Markdown 형식으로 변환한다.
export default function QuestionEditor({
  draft,
  setDraft,
  input,
  onValidityChange,
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Markdown,
      Placeholder.configure({
        placeholder: '지금 떠오른 질문을 여기에 적어주세요…',
      }),
    ],
    content: draft,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        id: 'question',
        role: 'textbox',
        'aria-label': '질문 내용',
        'aria-multiline': 'true',
        class: 'question-editor',
      },
    },
    onUpdate: ({ editor: current }) =>
      setDraft(current.getText().trim() ? current.getMarkdown() : ''),
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            list: current.isActive('bulletList'),
            count: current.getText().length,
          }
        : { bold: false, italic: false, list: false, count: 0 },
  })
  // 복원한 본문은 첫 편집 이벤트 전에도 글자 수와 제출 가능 상태에 반영한다.
  const count = editor?.getText().length || 0

  useEffect(() => {
    if (!editor) return
    // 제출 후 초기화만 반영한다. 입력 중에는 커서·한글 조합 상태를 유지한다.
    if (!draft && editor.getText().trim()) editor.commands.clearContent(false)
  }, [draft, editor])
  useEffect(() => {
    onValidityChange(count > 0 && count <= 240)
  }, [count, onValidityChange])

  const formats = [
    ['bold', '굵게', Bold, () => editor.chain().focus().toggleBold().run()],
    [
      'italic',
      '기울임',
      Italic,
      () => editor.chain().focus().toggleItalic().run(),
    ],
    [
      'list',
      '점 목록',
      List,
      () => editor.chain().focus().toggleBulletList().run(),
    ],
  ]
  return (
    <>
      <div
        ref={input}
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target === event.currentTarget) editor?.commands.focus()
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <div className="draft-footer">
        <div className="markdown-toolbar" role="group" aria-label="글자 서식">
          {formats.map(([key, label, Glyph, apply]) => (
            <button
              type="button"
              key={key}
              title={label}
              aria-label={label}
              aria-pressed={state[key]}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={apply}
            >
              <Glyph size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        <span>{count} / 240</span>
      </div>
      {count > 240 && (
        <p className="notice" role="status">
          240자 이내로 줄여주세요.
        </p>
      )}
    </>
  )
}
