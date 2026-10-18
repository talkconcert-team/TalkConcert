import { useEffect, useRef, useState } from 'react'
import { SLOT_DURATION } from '../slotDraw'
import './QuestionSlot.css'

const SLOT_FADE_DURATION = 450

// feat/slot의 감속 연출을 옮긴 컴포넌트. 추첨 결과 결정은 대시보드에서 담당한다.
export default function QuestionSlot({ slot, onFinish }) {
  const finish = useRef(onFinish)
  const [settling, setSettling] = useState(false)
  useEffect(() => {
    finish.current = onFinish
  }, [onFinish])

  useEffect(() => {
    // 모션 감소 설정에서는 즉시 결과를 표시한다. 애니메이션 이벤트 누락에도 완료를 보장한다.
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timer = window.setTimeout(
      () => finish.current(),
      reducedMotion ? 0 : SLOT_DURATION + SLOT_FADE_DURATION + 200,
    )
    return () => window.clearTimeout(timer)
  }, [slot])

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
          '--slot-duration': `${SLOT_DURATION}ms`,
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
