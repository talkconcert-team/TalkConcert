export const noteColors = [
  { id: 'cream', label: '버터 옐로', value: '#fff3bf' },
  { id: 'rose', label: '로즈 핑크', value: '#ffe4e8' },
  { id: 'mint', label: '민트', value: '#def3e7' },
  { id: 'sky', label: '하늘색', value: '#e0efff' },
  { id: 'lavender', label: '라벤더', value: '#ece4ff' },
  { id: 'white', label: '화이트', value: '#ffffff' },
]
export const stickers = ['💬', '💡', '🙋', '✨', '🌱', '🎤']
const defaultColumns = [
  { id: 'general', title: '자유롭게 질문해요' },
  { id: 'talk', title: '오늘의 발표' },
  { id: 'experience', title: '경험이 궁금해요' },
]
// 저장 형식을 확인하고 유효하지 않으면 기본 주제로 시작한다.
export function loadColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem('talkconcert-columns-v1'))
    if (
      Array.isArray(saved) &&
      saved.length &&
      saved.every(
        (item) => typeof item.id === 'string' && typeof item.title === 'string',
      )
    )
      return saved
  } catch {
    // 저장소가 차단되거나 JSON이 손상되어도 기본 데이터로 화면을 연다.
  }
  return defaultColumns
}
const examples = [
  {
    id: '1',
    text: '새로운 아이디어를 실행에 옮길 때 가장 먼저 확인하는 것은 무엇인가요?',
  },
  {
    id: '2',
    text: '지금의 커리어를 선택하게 된 결정적인 계기가 궁금해요.',
  },
  {
    id: '3',
    text: '실패했던 경험 중 지금 가장 도움이 된 경험은 무엇인가요?',
  },
  {
    id: '4',
    text: '좋은 팀을 만들기 위해 가장 중요하게 생각하는 기준이 있나요?',
  },
].map((item, index) => ({
  ...item,
  columnId: defaultColumns[index % 3].id,
  number: index + 1,
  color: noteColors[index].id,
  sticker: stickers[index],
}))

// 기존 저장 키를 유지해 폴더 구조가 바뀌어도 질문이 보존되도록 한다.
// 빈 배열도 유효한 저장값이며, 읽기에 실패했을 때만 예시 질문을 사용한다.
export function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem('talkconcert-board-v1'))
    if (
      Array.isArray(saved) &&
      saved.every(
        (item) =>
          typeof item.id === 'string' &&
          typeof item.text === 'string' &&
          Number.isInteger(item.number),
      )
    )
      return saved
  } catch {
    // 저장소가 차단되거나 JSON이 손상되어도 기본 데이터로 화면을 연다.
  }
  return examples
}

export function noteStyle(color) {
  return {
    '--note-color': (
      noteColors.find((item) => item.id === color) || noteColors[0]
    ).value,
  }
}
