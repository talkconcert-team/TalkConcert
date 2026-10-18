import BoardColumn from './BoardColumn'

// 주제별 열을 묶어 전체 질문을 표시한다.
export default function QuestionBoard({
  questions,
  board,
  columns,
  columnFor,
  composeIn,
  selectedId,
  openQuestion,
  drawing,
  canCompose,
  loaded,
  dragControls,
  busy,
  canManageMoves,
}) {
  return (
    <section className="panel list-panel" aria-labelledby="list-heading">
      <div className="panel-header">
        <h2 id="list-heading">
          오늘의 질문 <span className="muted">({questions.length})</span>
        </h2>
      </div>
      <p className="board-intro">
        평소에 궁금했거나 고민하던 내용들을 편하게 작성해 주세요 
      </p>
      <div className="memo-board" ref={board}>
        <div className="shelf-board">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              questions={questions}
              columnFor={columnFor}
              composeIn={composeIn}
              selectedId={selectedId}
              openQuestion={openQuestion}
              drawing={drawing}
              canCompose={canCompose}
              dragControls={dragControls}
              busy={busy}
            />
          ))}
        </div>
        {!questions.length && (
          <p className="board-empty">{loaded ? '첫 번째 질문을 남겨주세요.' : 'Supabase에서 질문을 불러오는 중이에요…'}</p>
        )}
      </div>
      <div className="list-footer">
        Supabase에 저장 · 5초마다 새로 확인
        <span>{canManageMoves ? '관리자 · 모든 카드의 손잡이를 끌어 이동' : '내 카드 손잡이를 끌거나 방향키로 이동'}</span>
      </div>
    </section>
  )
}
