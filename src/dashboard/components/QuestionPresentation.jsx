import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'

// 현장 화면에 선택한 질문을 크게 보여주는 모달이다.
export default function QuestionPresentation({
  selected,
  setPresenting,
  previewButton,
}) {
  const closeButton = useRef(null)
  useEffect(() => {
    // 모달 안에 포커스를 유지하고 닫으면 진입 버튼으로 돌려준다.
    const returnFocus = previewButton.current
    closeButton.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') setPresenting(false)
      if (event.key === 'Tab') {
        event.preventDefault()
        closeButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      returnFocus?.focus()
    }
  }, [previewButton, setPresenting])

  return (
    <div
      className="presentation"
      role="dialog"
      aria-modal="true"
      aria-label="질문 크게 보기"
    >
      <button
        ref={closeButton}
        className="close-preview outline-button"
        onClick={() => setPresenting(false)}
      >
        <Icon name="close" /> 닫기
      </button>
      <span>TalkConcert / 관객 질문</span>
      <blockquote>{selected.text}</blockquote>
      <p>익명의 관객</p>
    </div>
  )
}
