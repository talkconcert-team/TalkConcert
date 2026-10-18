import { useEffect, useRef, useState } from 'react'
import { SLOT_FADE_DURATION, slotTiming } from '../slotDraw'
import './QuestionSlot.css'

// feat/slot의 감속·사라짐 연출을 유지하며 DB가 확정한 당첨자를 표시한다.
export default function QuestionSlot({ slot, onFinish }) {
  const finish = useRef(onFinish)
  const [settling, setSettling] = useState(false)
  const timing = slotTiming()
  useEffect(() => {
    finish.current = onFinish
  }, [onFinish])

  useEffect(() => {
    // 사용자가 실행한 추첨은 기존 슬롯 연출을 끝까지 보여준다. 이벤트 누락 시에도 완료한다.
    const timer = window.setTimeout(
      () => finish.current(),
      timing.finish,
    )
    return () => window.clearTimeout(timer)
  }, [slot, timing.finish])

  useEffect(() => {
    if (!settling) return undefined
    const timer = window.setTimeout(() => finish.current(), SLOT_FADE_DURATION)
    return () => window.clearTimeout(timer)
  }, [settling])

  return (
    <div className="slot-machine" role="status" aria-label="질문을 추첨하는 중">
      <div
        className={settling ? 'slot-track is-settling' : 'slot-track'}
        aria-hidden="true"
        style={{
          '--slot-index': slot.targetIndex,
          '--slot-duration': `${timing.roll}ms`,
        }}
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === 'slot-roll-to-center'
          )
            setSettling(true)
        }}
      >
        {slot.items.map((item, index) => (
          <div
            className={
              index === slot.targetIndex
                ? 'slot-question'
                : 'slot-question slot-question--surrounding'
            }
            key={`${item.id}-${index}`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  )
}
