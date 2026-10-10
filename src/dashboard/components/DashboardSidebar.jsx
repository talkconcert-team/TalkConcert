import Icon from '../../components/Icon'

// 현장에서 바로 사용할 랜덤 추첨 버튼을 제공한다.
export default function DashboardSidebar({ drawing, draw, questions }) {
  return (
    <aside className="sidebar" aria-label="질문 추첨">
      <button
        className={drawing ? 'random-control drawing' : 'random-control'}
        onClick={draw}
        disabled={drawing || !questions.length}
        aria-label="랜덤 질문 뽑기"
        title="랜덤 질문 뽑기"
      >
        <Icon name="shuffle" size={21} />
      </button>
    </aside>
  )
}
