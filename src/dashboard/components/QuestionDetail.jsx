import Icon from '../../components/Icon'
import { noteStyle } from '../dashboardData'

// 선택된 질문을 함께 읽고 답변 완료로 처리하는 패널이다.
export default function QuestionDetail({
  selected,
  drawing,
  complete,
  waiting,
}) {
  return (
    <section
      className="panel detail-panel"
      aria-labelledby="detail-heading"
      aria-busy={drawing}
    >
      <div className="panel-header detail-header">
        <h2 id="detail-heading">
          {selected
            ? 'Q' + String(selected.number).padStart(2, '0')
            : '선택된 질문'}
        </h2>
        <div className="detail-tools">
          {selected && !selected.answered && (
            <button
              className="outline-button"
              disabled={drawing}
              onClick={complete}
            >
              <Icon name="check" size={16} /> 답변 완료
            </button>
          )}
          <span className="detail-badge">
            <Icon name="message" size={16} />{' '}
            {selected?.answered ? '답변 완료' : '관객 질문'}
          </span>
        </div>
      </div>
      <div className="detail-content" aria-live="polite">
        <article className="question-detail">
          <div className="detail-card-heading">
            <h3>
              {drawing
                ? '질문을 고르는 중'
                : selected
                  ? '지금 함께 나눌 질문'
                  : '어떤 질문부터 이야기할까요?'}
            </h3>
            <Icon name="message" size={18} />
          </div>
          <p className="detail-description">
            {drawing
              ? '대기 중인 질문에서 하나를 선택하고 있어요.'
              : selected
                ? '익명의 관객이 남긴 질문이에요.'
                : '목록에서 질문을 선택하거나 왼쪽 추첨 버튼을 눌러주세요.'}
          </p>
          <div
            style={selected && !drawing ? noteStyle(selected.color) : undefined}
            className={
              selected && !drawing
                ? 'question-display populated'
                : 'question-display'
            }
          >
            {drawing ? (
              <Icon name="shuffle" size={30} />
            ) : selected ? (
              <blockquote>{selected.text}</blockquote>
            ) : (
              <>
                <Icon name="message" size={28} />
                <p>아직 선택한 질문이 없어요</p>
              </>
            )}
          </div>
          <div className="detail-summary">
            <span className="status-dot" />
            {selected
              ? selected.answered
                ? '답변을 마친 질문입니다.'
                : '질문을 읽고 현장에서 이야기를 나눠주세요.'
              : waiting.length + '개의 질문이 답변을 기다리고 있어요.'}
          </div>
        </article>
      </div>
    </section>
  )
}
