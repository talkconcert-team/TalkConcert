import Icon from '../../components/Icon'
import { noteStyle } from '../dashboardData'

// 내용 길이에 맞춰 자라는 질문 카드. 읽기 버튼과 이동 손잡이를 분리한다.
export default function NoteCard({
  item,
  selectedId,
  setSelectedId,
  drawing,
  drag,
  dropTarget,
  startDrag,
  dragMove,
  finishDrag,
  cancelDrag,
  moveWithKeyboard,
}) {
  return (
    <article
      data-note-id={item.id}
      style={noteStyle(item.color)}
      className={
        'memo-note' +
        (selectedId === item.id ? ' selected' : '') +
        (item.answered ? ' is-answered' : '') +
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
          <span className="note-sticker" aria-hidden="true">
            {item.sticker}
          </span>
          <span>
            익명의 관객<small>{item.own ? '내 질문' : '관객 질문'}</small>
          </span>
        </span>
        <button
          type="button"
          className="drag-handle"
          disabled={drawing}
          title="끌어서 순서 변경 · 방향키로 이동"
          aria-label={'질문 ' + item.number + ' 순서 변경, 방향키로 이동'}
          onPointerDown={(event) => startDrag(event, item)}
          onPointerMove={dragMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onKeyDown={(event) => moveWithKeyboard(event, item)}
        >
          <Icon name="grip" />
        </button>
      </div>
      <button
        className="memo-read"
        onClick={() => setSelectedId(item.id)}
        disabled={drawing}
        aria-pressed={selectedId === item.id}
      >
        <span className="memo-text">{item.text}</span>
        <span className="memo-footer">
          <span>Q{String(item.number).padStart(2, '0')}</span>
          <span className="memo-status">
            {item.answered ? (
              <>
                <Icon name="check" size={12} /> 답변 완료
              </>
            ) : selectedId === item.id ? (
              '함께 읽는 중'
            ) : (
              '답변 대기'
            )}
          </span>
        </span>
      </button>
    </article>
  )
}
