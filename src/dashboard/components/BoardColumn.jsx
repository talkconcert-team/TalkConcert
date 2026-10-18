import Icon from '../../components/Icon'
import NoteCard from './NoteCard'

// 주제별로 카드를 표시한다. 이동 권한은 카드별로, 작성 진입점은 관객에게 제공한다.
export default function BoardColumn({
  column,
  questions,
  columnFor,
  composeIn,
  selectedId,
  openQuestion,
  drawing,
  canCompose,
  dragControls,
  busy,
}) {
  return (
    <section
      data-column-id={column.id}
      className={'board-column' + (dragControls.dropTarget?.columnId === column.id ? ' column-hover' : '')}
      aria-label={column.title}
    >
      <div className="column-heading">
        <h3 className="column-title">{column.title}</h3>
        <span>
          {questions.filter((item) => columnFor(item) === column.id).length}
        </span>
      </div>
      {canCompose && <button
        className="column-add"
        onClick={() => composeIn(column.id)}
        aria-label={column.title + '에 질문 추가'}
      >
        <Icon name="plus" size={18} />
      </button>}
      <div className="column-notes">
        {questions
          .filter((item) => columnFor(item) === column.id)
          .map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              selectedId={selectedId}
              openQuestion={openQuestion}
              drawing={drawing}
              {...dragControls}
              busy={busy}
            />
          ))}
      </div>
      {!questions.some((item) => columnFor(item) === column.id) && (
        <p className="column-empty">첫 질문을 남겨주세요</p>
      )}
    </section>
  )
}
