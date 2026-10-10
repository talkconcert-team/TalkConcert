import Icon from '../../components/Icon'
import BoardColumn from './BoardColumn'

// 상태 필터와 주제별 열을 묶어 전체 질문을 표시한다.
export default function QuestionBoard({
  questions,
  addColumn,
  filter,
  setFilter,
  board,
  columns,
  columnFor,
  visibleQuestions,
  editingColumn,
  renameColumn,
  setEditingColumn,
  composeIn,
  selectedId,
  setSelectedId,
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
      <div className="filter-tabs" aria-label="질문 필터">
        {[
          ['all', '전체'],
          ['waiting', '대기 중'],
          ['answered', '답변 완료'],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="memo-board" ref={board}>
        <div className="shelf-board">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              questions={questions}
              columnFor={columnFor}
              visibleQuestions={visibleQuestions}
              editingColumn={editingColumn}
              renameColumn={renameColumn}
              setEditingColumn={setEditingColumn}
              composeIn={composeIn}
              filter={filter}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              drawing={drawing}
              dragControls={dragControls}
            />
          ))}
          <button className="new-column" onClick={addColumn}>
            <Icon name="plus" size={16} /> 주제 추가
          </button>
        </div>
        {!visibleQuestions.length && (
          <p className="board-empty">
            {filter === 'answered'
              ? '아직 답변을 마친 질문이 없어요.'
              : '첫 번째 질문을 남겨주세요.'}
          </p>
        )}
      </div>
      <div className="list-footer">
        <Icon name="grip" size={14} /> 자유롭게 순서 변경{' '}
        <span>이 브라우저에 저장 · 예시 질문 포함</span>
      </div>
    </section>
  )
}
