import Icon from '../../components/Icon'
import AdminSignOut from '../../components/AdminSignOut'
import SchoolBrand from '../../components/SchoolBrand'

// 전체 질문 수와 선택한 질문의 크게 보기 진입점을 표시한다.
export default function DashboardHeader({
  questions,
  setPresenting,
  selected,
  drawing,
  isPresenter,
  signedIn,
  accountEmail,
  requestLogin,
  loggingIn,
}) {
  return (
    <>
      {' '}
      <header className="topbar">
        <div className="breadcrumb">
          <SchoolBrand />
        </div>
        <span className="session-label">Q&A</span>
        <div className="header-actions">
          <span className="count-pill">
            <Icon name="message" size={15} /> {questions.length}개의 질문
          </span>
          <span className="demo-label">{isPresenter ? '진행 화면' : '관객 화면'}</span>
          {isPresenter && <a className="admin-settings-link" href="/admin">관리자 설정</a>}
          {signedIn ? <><span className="account-label" title={accountEmail} aria-label={`로그인 계정: ${accountEmail}`}>{accountEmail}</span><AdminSignOut returnTo={isPresenter ? '/admin' : '/'} /></> : <button className="text-button" disabled={loggingIn} onClick={() => requestLogin()}>Google로 로그인</button>}
        </div>
      </header>
      <div className="toolbar">
        <div className="view-label">
          <Icon name="edit" /> 질문 보드
        </div>
        <span className="toolbar-caption">{isPresenter ? '질문을 선택하거나 추첨하세요.' : '질문을 남기고, 함께 이야기해요.'}</span>
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
