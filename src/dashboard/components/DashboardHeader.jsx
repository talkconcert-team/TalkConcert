import Icon from '../../components/Icon'

// 전체 질문 수와 선택한 질문의 크게 보기 진입점을 표시한다.
export default function DashboardHeader({
  questions,
  setPresenting,
  selected,
  drawing,
}) {
  return (
    <>
      {' '}
      <header className="topbar">
        <div className="breadcrumb">
          <span>TalkConcert 2026</span>
        </div>
        <span className="session-label">Q&A</span>
        <div className="header-actions">
          <span className="count-pill">
            <Icon name="message" size={15} /> {questions.length}개의 질문
          </span>
          <span className="demo-label">미리보기</span>
        </div>
      </header>
      <div className="toolbar">
        <div className="view-label">
          <Icon name="edit" /> 질문 보드
        </div>
        <span className="toolbar-caption">질문을 남기고, 함께 이야기해요.</span>
        <button
          className="text-button preview-button"
          onClick={() => setPresenting(true)}
          disabled={!selected || drawing}
        >
          <Icon name="expand" /> 크게 보기
        </button>
      </div>
    </>
  )
}
