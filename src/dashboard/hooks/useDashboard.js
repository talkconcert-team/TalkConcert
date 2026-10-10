import { useEffect, useRef, useState } from 'react'
import { loadNotes, loadColumns } from '../dashboardData'
import { createSlotDraw } from '../slotDraw'

// 작성·선택·추첨 상태와 브라우저 저장을 관리한다. 서버 동기화는 포함하지 않는다.
export default function useDashboard() {
  const [questions, setQuestions] = useState(loadNotes)
  const [columns, setColumns] = useState(loadColumns)
  const [composeColumn, setComposeColumn] = useState(() => loadColumns()[0].id)
  const [editingColumn, setEditingColumn] = useState(null)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('cream')
  const [selectedId, setSelectedId] = useState(null)
  const [presenting, setPresenting] = useState(false)
  const [slot, setSlot] = useState(null)
  const drawing = slot !== null
  const activeDraw = useRef(null)
  const [notice, setNotice] = useState('')
  const input = useRef(null)
  const board = useRef(null)
  const selected = questions.find((item) => item.id === selectedId)
  // 예전 저장 데이터에 주제가 없거나 현재 열과 맞지 않으면 첫 번째 열에 표시한다.
  const columnFor = (item) =>
    columns.some((column) => column.id === item.columnId)
      ? item.columnId
      : columns[0].id

  useEffect(() => {
    try {
      localStorage.setItem('talkconcert-columns-v1', JSON.stringify(columns))
    } catch {
      // 저장소 접근·용량 오류를 사용자에게 알리기 위한 예외적인 상태 갱신이다.
      // oxlint-disable-next-line react/set-state-in-effect
      setNotice('열 제목을 이 브라우저에 저장하지 못했어요.')
    }
  }, [columns])

  function addColumn() {
    const id = crypto.randomUUID()
    setColumns((current) => [...current, { id, title: '새 주제' }])
    setEditingColumn(id)
    setComposeColumn(id)
  }

  function composeIn(id) {
    setComposeColumn(id)
    input.current?.focus()
  }

  function renameColumn(id, title) {
    setColumns((current) =>
      current.map((column) =>
        column.id === id
          ? { ...column, title: title.trim() || column.title }
          : column,
      ),
    )
    setEditingColumn(null)
  }

  useEffect(() => {
    try {
      localStorage.setItem('talkconcert-board-v1', JSON.stringify(questions))
    } catch {
      // 저장소 접근·용량 오류를 사용자에게 알리기 위한 예외적인 상태 갱신이다.
      // oxlint-disable-next-line react/set-state-in-effect
      setNotice('이 브라우저에서는 새로고침 후 메모를 유지할 수 없어요.')
    }
  }, [questions])

  function submit(event) {
    event.preventDefault()
    if (!draft.trim()) {
      input.current?.focus()
      return
    }
    const item = {
      id: crypto.randomUUID(),
      columnId: composeColumn,
      // 배열 순서와 별개인 질문 번호라 드래그해도 번호는 유지된다.
      number: Math.max(0, ...questions.map((note) => note.number)) + 1,
      text: draft.trim(),
      color,
      own: true,
    }
    setQuestions((current) => [item, ...current])
    setDraft('')
    setNotice('질문이 등록됐어요.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  function draw() {
    if (activeDraw.current || questions.length === 0) return
    const nextSlot = createSlotDraw(questions, selectedId)
    activeDraw.current = nextSlot
    setSlot(nextSlot)
    setPresenting(true)
    setNotice('질문을 뽑고 있어요.')
  }

  function finishDraw() {
    const result = activeDraw.current
    if (!result) return
    // 결과는 추첨 시작 때 확정한다. 화면 크기나 애니메이션 종료 시점에 영향받지 않는다.
    setSelectedId(result.target.id)
    activeDraw.current = null
    setSlot(null)
    setNotice('랜덤 질문을 선택했어요.')
  }

  function closePresentation() {
    // 중간에 닫으면 추첨을 취소해 이전 결과가 뒤늦게 표시되지 않게 한다.
    activeDraw.current = null
    setSlot(null)
    setPresenting(false)
  }

  // 카드 선택과 랜덤 추첨 모두 같은 크게 보기 화면으로 연결한다.
  function openQuestion(id) {
    if (drawing) return
    setSelectedId(id)
    setPresenting(true)
  }

  return {
    questions,
    setQuestions,
    columns,
    composeColumn,
    setComposeColumn,
    editingColumn,
    setEditingColumn,
    draft,
    setDraft,
    color,
    setColor,
    selectedId,
    openQuestion,
    presenting,
    setPresenting,
    drawing,
    slot,
    finishDraw,
    closePresentation,
    notice,
    setNotice,
    input,
    board,
    selected,
    columnFor,
    addColumn,
    composeIn,
    renameColumn,
    submit,
    draw,
  }
}
