import { useEffect, useRef, useState } from 'react'
import { loadNotes, loadColumns } from '../dashboardData'

// 작성·선택·추첨·답변 상태와 브라우저 저장을 관리한다. 서버 동기화는 포함하지 않는다.
export default function useDashboard() {
  const [questions, setQuestions] = useState(loadNotes)
  const [columns, setColumns] = useState(loadColumns)
  const [composeColumn, setComposeColumn] = useState(() => loadColumns()[0].id)
  const [editingColumn, setEditingColumn] = useState(null)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('cream')
  const [sticker, setSticker] = useState('💬')
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [drawing, setDrawing] = useState(false)
  const [notice, setNotice] = useState('')
  const input = useRef(null)
  const board = useRef(null)
  const timer = useRef(null)
  const selected = questions.find((item) => item.id === selectedId)
  const waiting = questions.filter((item) => !item.answered)
  const visibleQuestions = questions.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'answered' ? item.answered : !item.answered),
  )
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

  // 화면을 떠난 뒤 추첨 타이머가 상태를 갱신하지 않도록 정리한다.
  useEffect(() => () => window.clearTimeout(timer.current), [])
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
      answered: false,
      color,
      sticker,
      own: true,
    }
    setQuestions((current) => [item, ...current])
    setDraft('')
    setFilter('all')
    setNotice('질문이 등록됐어요.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  function draw() {
    if (drawing || waiting.length === 0) return
    // 미답변 질문만 추첨하며, 후보가 여럿이면 현재 선택된 질문은 제외한다.
    const others = waiting.filter((item) => item.id !== selectedId)
    const candidates = others.length ? others : waiting
    setDrawing(true)
    setNotice('질문을 뽑고 있어요.')
    timer.current = window.setTimeout(() => {
      setSelectedId(
        candidates[Math.floor(Math.random() * candidates.length)].id,
      )
      setDrawing(false)
      setNotice('랜덤 질문을 선택했어요.')
    }, 650)
  }

  function complete() {
    setQuestions((current) =>
      current.map((item) =>
        item.id === selectedId ? { ...item, answered: true } : item,
      ),
    )
    setNotice('답변 완료로 표시했어요.')
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
    sticker,
    setSticker,
    selectedId,
    setSelectedId,
    filter,
    setFilter,
    drawing,
    notice,
    setNotice,
    input,
    board,
    selected,
    waiting,
    visibleQuestions,
    columnFor,
    addColumn,
    composeIn,
    renameColumn,
    submit,
    draw,
    complete,
  }
}
