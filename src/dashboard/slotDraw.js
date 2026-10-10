export const SLOT_DURATION = 6000

// 후보 수와 상관없이 트랙 길이를 제한하고, 마지막 중앙 카드와 실제 결과를 일치시킨다.
export function createSlotDraw(questions, selectedId, random = Math.random) {
  if (!questions.length) return null
  const others = questions.filter((item) => item.id !== selectedId)
  const candidates = others.length ? others : questions
  const target = candidates[Math.floor(random() * candidates.length)]
  const targetIndex = 32
  const items = Array.from({ length: targetIndex + 3 }, (_, index) =>
    index === targetIndex ? target : candidates[index % candidates.length],
  )
  return { target, targetIndex, items }
}
