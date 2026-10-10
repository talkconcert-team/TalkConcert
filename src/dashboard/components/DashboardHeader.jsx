import Icon from '../../components/Icon'

// 전체 질문 수와 선택한 질문의 크게 보기 진입점을 표시한다.
export default function DashboardHeader({
  questions,
  previewButton,
  setPresenting,
  selected,
  drawing,
}) {
  return (
    <>
      {' '}
      <header className="topbar">
        <div className="breadcrumb">
          <span>TalkConcert</span>
          <span className="slash">/</span>
          <h1>오늘의 토크 콘서트</h1>
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
          ref={previewButton}
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
