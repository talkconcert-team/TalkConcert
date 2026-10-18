import QuestionMarkdown from './QuestionMarkdown'
import Icon from '../../components/Icon'
import { noteStyle } from '../dashboardData'

// 내용 길이에 맞춰 자라는 질문 카드. 읽기 버튼과 이동 손잡이를 분리한다.
export default function NoteCard({
  item,
  selectedId,
  openQuestion,
  drawing,
  drag,
  dropTarget,
  startDrag,
  dragMove,
  finishDrag,
  cancelDrag,
  moveWithKeyboard,
  busy,
}) {
  return (
    <article
      data-note-id={item.id}
      style={noteStyle(item.color)}
      className={
        'memo-note' +
        (drag?.item.id === item.id ? ' is-dragging' : '') +
        (dropTarget?.id === item.id
          ? dropTarget.after
            ? ' drop-after'
            : ' drop-before'
          : '')
      }
    >
      <div className="memo-top">
        <span className="note-author">
          <span>
            {item.own ? '내 질문' : '익명 관객 · #' + String(item.number)}
          </span>
        </span>
        {item.movable && (
          <button
            type="button"
            className="drag-handle"
            disabled={drawing || busy}
            aria-label={`질문 #${item.number} 이동`}
            title="끌어서 이동 · 좌우 방향키로 주제 이동 · 위아래 방향키로 순서 변경"
            onPointerDown={(event) => startDrag(event, item)}
            onPointerMove={dragMove}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={(event) => moveWithKeyboard(event, item)}
          >
            <Icon name="grip" />
          </button>
        )}
      </div>
      <button
        className="memo-read"
        onClick={() => openQuestion(item.id)}
        disabled={drawing}
        aria-pressed={selectedId === item.id}
      >
        <span className="memo-text">
          <QuestionMarkdown>{item.text}</QuestionMarkdown>
        </span>
      </button>
    </article>
  )
}
