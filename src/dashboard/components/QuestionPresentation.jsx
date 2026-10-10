import QuestionMarkdown from './QuestionMarkdown'
import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import QuestionSlot from './QuestionSlot'

// 직접 고르거나 추첨한 질문을 같은 화면에서 크게 읽는다.
export default function QuestionPresentation({
  selected,
  slot,
  finishDraw,
  closePresentation,
}) {
  const dialog = useRef(null)

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
      <span>
        TalkConcert / 오늘의 질문
      </span>
      {slot ? (
        <QuestionSlot slot={slot} onFinish={finishDraw} />
      ) : (
        selected && (
          <>
            <blockquote>
              <QuestionMarkdown>{selected.text}</QuestionMarkdown>
            </blockquote>
          </>
        )
      )}
    </dialog>
  )
}
