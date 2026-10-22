export const SLOT_DURATION = 6000
export const SLOT_FADE_DURATION = 450
export function slotTiming() {
  return { roll: SLOT_DURATION, finish: SLOT_DURATION + SLOT_FADE_DURATION + 200 }
}

// CSS 트랙의 실제 위치에서 중앙 질문을 구한다. 시간 추정은 감속·탭 전환 때 어긋난다.
export function visibleSlotIndex(translateY, itemHeight, itemCount) {
  if (!Number.isFinite(translateY) || itemHeight <= 0 || itemCount <= 0) return 0
  return Math.max(0, Math.min(itemCount - 1, Math.round(-translateY / itemHeight - 0.5)))
}

// 후보 수와 상관없이 트랙 길이를 제한하고, 마지막 중앙 카드와 실제 결과를 일치시킨다.
export function createSlotDraw(questions, target) {
  if (!target) return null
  // 애니메이션은 DB에서 이미 저장한 결과만 보여준다. 브라우저에서 다시 뽑지 않는다.
  const candidates = questions.length ? questions : [target]
  const targetIndex = 32
  const items = Array.from({ length: targetIndex + 3 }, (_, index) =>
    index === targetIndex ? target : candidates[index % candidates.length],
  )
  return { target, targetIndex, items }
}
