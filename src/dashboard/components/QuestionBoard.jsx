import Icon from '../../components/Icon'
import BoardColumn from './BoardColumn'

// 주제별 열을 묶어 전체 질문을 표시한다.
export default function QuestionBoard({
  questions,
  addColumn,
  board,
  columns,
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
  return (
    <section className="panel list-panel" aria-labelledby="list-heading">
      <div className="panel-header">
        <h2 id="list-heading">
          우리의 질문 <span className="muted">({questions.length})</span>
        </h2>
        <button className="primary-button" onClick={addColumn}>
          <Icon name="plus" size={16} /> 주제 추가
        </button>
      </div>
      <p className="board-intro">
        주제 아래에 질문을 붙여보세요. 메모를 다른 주제로 옮겨도 좋아요.
      </p>
      <div className="memo-board" ref={board}>
        <div className="shelf-board">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              questions={questions}
              columnFor={columnFor}
              editingColumn={editingColumn}
              renameColumn={renameColumn}
              setEditingColumn={setEditingColumn}
              composeIn={composeIn}
              selectedId={selectedId}
              openQuestion={openQuestion}
              drawing={drawing}
              dragControls={dragControls}
            />
          ))}
          <button className="new-column" onClick={addColumn}>
            <Icon name="plus" size={16} /> 주제 추가
          </button>
        </div>
        {!questions.length && (
          <p className="board-empty">첫 번째 질문을 남겨주세요.</p>
        )}
      </div>
      <div className="list-footer">
        <Icon name="grip" size={14} /> 자유롭게 순서 변경{' '}
        <span>이 브라우저에 저장 · 예시 질문 포함</span>
      </div>
    </section>
  )
}
