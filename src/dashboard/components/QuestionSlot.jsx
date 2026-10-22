import { useEffect, useRef, useState } from 'react'
import { SLOT_FADE_DURATION, slotTiming, visibleSlotIndex } from '../slotDraw'
import './QuestionSlot.css'

// feat/slot의 감속·사라짐 연출을 유지하며 DB가 확정한 당첨자를 표시한다.
export default function QuestionSlot({ slot, onFinish, onVisibleQuestion }) {
  const finish = useRef(onFinish)
  const track = useRef(null)
  const [settling, setSettling] = useState(false)
  const timing = slotTiming()
  useEffect(() => {
    finish.current = onFinish
  }, [onFinish])

  useEffect(() => {
    let frame
    let previous = -1
    const syncTitle = () => {
      const element = track.current
      if (!element) return
      const style = getComputedStyle(element)
      const offset = style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
      const height = element.firstElementChild?.getBoundingClientRect().height || 190
      const index = visibleSlotIndex(offset, height, slot.items.length)
      if (index !== previous) {
        previous = index
        onVisibleQuestion({ requestId: slot.requestId, question: slot.items[index] })
      }
      frame = requestAnimationFrame(syncTitle)
    }
    // 글자 제목도 실제로 중앙을 지나는 카드와 함께 바꾼다. 당첨자와 추첨 이력은 건드리지 않는다.
    frame = requestAnimationFrame(syncTitle)
    return () => cancelAnimationFrame(frame)
  }, [slot, onVisibleQuestion])

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
        ref={track}
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
