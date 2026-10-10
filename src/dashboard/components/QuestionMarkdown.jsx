import Markdown from 'react-markdown'
import './QuestionMarkdown.css'

// 카드 버튼 안에서도 유효한 마크업으로 렌더링한다. 원시 HTML과 외부 이미지는 허용하지 않는다.
const blocks = Object.fromEntries(
  [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
  ].map((tag) => [
    tag,
    ({ children }) => <span className={`markdown-${tag}`}>{children}</span>,
  ]),
)
const components = { ...blocks, a: ({ children }) => <span>{children}</span> }

export default function QuestionMarkdown({ children }) {
  return (
    <span className="question-markdown">
      <Markdown
        skipHtml
        allowedElements={['p', 'strong', 'em', 'ul', 'li', 'br']}
        unwrapDisallowed
        components={components}
      >
        {children}
      </Markdown>
    </span>
  )
}
