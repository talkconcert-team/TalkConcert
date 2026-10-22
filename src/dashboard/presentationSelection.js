// 추첨 결과는 당시 원문을 보관하고, 일반 카드 열람은 최신 보드의 수정·삭제를 반영한다.
export function presentationSelection(selection, questions) {
  if (!selection) return null
  return selection.mode === 'draw' ? selection.question : questions.find((item) => item.id === selection.question.id) || null
}

// 새 추첨은 당시 주제명을 사용하고, 이전 추첨과 카드 열람은 현재 주제명을 찾는다.
export function presentationTopic(question, columns) {
  return question?.topicTitle || columns.find((column) => column.id === question?.columnId)?.title || '오늘의 질문'
}
