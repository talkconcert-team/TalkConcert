import Icon from '../../components/Icon'
import NoteCard from './NoteCard'

// 한 주제의 제목 편집, 질문 추가, 메모 목록과 빈 열의 드롭 영역을 담당한다.
export default function BoardColumn({
  column,
  questions,
  columnFor,
  editingColumn,
  renameColumn,
  setEditingColumn,
  composeIn,
  selectedId,
  openQuestion,
  drawing,
  dragControls,
}) {
  const { dropTarget } = dragControls
  return (
    <section
      data-column-id={column.id}
      className={
        'board-column' +
        (dropTarget?.columnId === column.id ? ' column-hover' : '')
      }
      aria-label={column.title}
    >
      <div className="column-heading">
        {editingColumn === column.id ? (
          <input
            aria-label="주제 제목"
            autoFocus
            maxLength={40}
            defaultValue={column.title}
            onBlur={(event) => renameColumn(column.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                event.currentTarget.blur()
              if (event.key === 'Escape') setEditingColumn(null)
            }}
          />
        ) : (
          <button
            className="column-title"
            title="주제 제목 수정"
            onClick={() => setEditingColumn(column.id)}
          >
            {column.title}
            <Icon name="edit" size={12} />
          </button>
        )}
        <span>
          {questions.filter((item) => columnFor(item) === column.id).length}
        </span>
      </div>
      <button
        className="column-add"
        onClick={() => composeIn(column.id)}
        aria-label={column.title + '에 질문 추가'}
      >
        <Icon name="plus" size={18} />
      </button>
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
            />
          ))}
      </div>
      {!questions.some((item) => columnFor(item) === column.id) && (
        <p className="column-empty">첫 질문을 남겨주세요</p>
      )}
    </section>
  )
}
