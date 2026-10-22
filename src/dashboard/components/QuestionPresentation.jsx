import QuestionMarkdown from './QuestionMarkdown'
import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import QuestionSlot from './QuestionSlot'
import { presentationTopic } from '../presentationSelection'

// 직접 고르거나 추첨한 질문을 같은 화면에서 크게 읽는다.
export default function QuestionPresentation({
  selected,
  columns,
  slot,
  finishDraw,
  closePresentation,
}) {
  const dialog = useRef(null)
  const [visibleQuestion, setVisibleQuestion] = useState(null)
  const headingQuestion = slot
    ? visibleQuestion?.requestId === slot.requestId ? visibleQuestion.question : slot.items[0]
    : selected

  useEffect(() => {
    const modal = dialog.current
    // 네이티브 모달로 배경 조작과 포커스 이탈을 막고, 닫으면 진입 위치로 돌아간다.
    modal.showModal()
    return () => modal.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="presentation"
      aria-label="질문 크게 보기"
      onCancel={(event) => {
        event.preventDefault()
        closePresentation()
      }}
    >
      <button
        autoFocus
        className="close-preview outline-button"
        onClick={() => closePresentation()}
      >
        <Icon name="close" /> 작게 보기
      </button>
      <div className="presentation-content">
        <span>TalkConcert</span>
        <h2 className="presentation-topic">{presentationTopic(headingQuestion, columns)}</h2>
        {slot ? (
          <QuestionSlot key={slot.requestId} slot={slot} onFinish={finishDraw} onVisibleQuestion={setVisibleQuestion} />
        ) : (
          selected ? (
            <blockquote>
              <QuestionMarkdown>{selected.text}</QuestionMarkdown>
            </blockquote>
          ) : <p role="status">이 질문은 보드에서 삭제되었어요. 작게 보기를 눌러 다른 질문을 선택해 주세요.</p>
        )}
      </div>
    </dialog>
  )
}
