import { useEffect, useRef, useState } from 'react'
import './App.css'
import { moveNote } from './lib/board'

const noteColors = [
  { id: 'cream', label: '버터 옐로', value: '#fff3bf' },
  { id: 'rose', label: '로즈 핑크', value: '#ffe4e8' },
  { id: 'mint', label: '민트', value: '#def3e7' },
  { id: 'sky', label: '하늘색', value: '#e0efff' },
  { id: 'lavender', label: '라벤더', value: '#ece4ff' },
  { id: 'white', label: '화이트', value: '#ffffff' },
]
const stickers = ['💬', '💡', '🙋', '✨', '🌱', '🎤']
const defaultColumns = [
  { id: 'general', title: '자유롭게 질문해요' },
  { id: 'talk', title: '오늘의 발표' },
  { id: 'experience', title: '경험이 궁금해요' },
]
function loadColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem('talkconcert-columns-v1'))
    if (Array.isArray(saved) && saved.length && saved.every(item => typeof item.id === 'string' && typeof item.title === 'string')) return saved
  } catch { /* Storage may be unavailable. */ }
  return defaultColumns
}
const examples = [
  { id: '1', text: '새로운 아이디어를 실행에 옮길 때 가장 먼저 확인하는 것은 무엇인가요?', answered: false },
  { id: '2', text: '지금의 커리어를 선택하게 된 결정적인 계기가 궁금해요.', answered: false },
  { id: '3', text: '실패했던 경험 중 지금 가장 도움이 된 경험은 무엇인가요?', answered: false },
  { id: '4', text: '좋은 팀을 만들기 위해 가장 중요하게 생각하는 기준이 있나요?', answered: true },
].map((item, index) => ({ ...item, columnId: defaultColumns[index % 3].id, number: index + 1, color: noteColors[index].id, sticker: stickers[index] }))

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem('talkconcert-board-v1'))
    if (Array.isArray(saved) && saved.every(item => typeof item.id === 'string' && typeof item.text === 'string' && typeof item.answered === 'boolean' && Number.isInteger(item.number))) return saved
  } catch { /* Storage may be unavailable. */ }
  return examples
}

function noteStyle(color) {
  return { '--note-color': (noteColors.find(item => item.id === color) || noteColors[0]).value }
}

function Icon({ name, size = 18 }) {
  const paths = {
    grip: <>{[7, 12, 17].map(y => <g key={y}><circle cx="9" cy={y} r=".8" /><circle cx="15" cy={y} r=".8" /></g>)}</>,
    message: <><rect x="3" y="4" width="18" height="14" rx="3" /><path d="m7 18-2 4v-4M8 9h8M8 13h5" /></>,
    shuffle: <><path d="m3 5 3 0c5 0 7 14 12 14h3M17 15l4 4-4 4M3 19h3c2 0 4-3 5-5M14 9c1-2 3-4 4-4h3M17 1l4 4-4 4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M12 20V4m-6 6 6-6 6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="m14 4 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z" /></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function App() {
  const [questions, setQuestions] = useState(loadNotes)
  const [columns, setColumns] = useState(loadColumns)
  const [composeColumn, setComposeColumn] = useState(() => loadColumns()[0].id)
  const [editingColumn, setEditingColumn] = useState(null)
  const [drag, setDrag] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const dropRef = useRef(null)
  const dragRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('cream')
  const [sticker, setSticker] = useState('💬')
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [drawing, setDrawing] = useState(false)
  const [notice, setNotice] = useState('')
  const [presenting, setPresenting] = useState(false)
  const input = useRef(null)
  const board = useRef(null)
  const timer = useRef(null)
  const previewButton = useRef(null)
  const closeButton = useRef(null)
  const selected = questions.find(item => item.id === selectedId)
  const waiting = questions.filter(item => !item.answered)
  const visibleQuestions = questions.filter(item => filter === 'all' || (filter === 'answered' ? item.answered : !item.answered))
  const columnFor = item => columns.some(column => column.id === item.columnId) ? item.columnId : columns[0].id

  useEffect(() => {
    try { localStorage.setItem('talkconcert-columns-v1', JSON.stringify(columns)) }
    catch { setNotice('열 제목을 이 브라우저에 저장하지 못했어요.') }
  }, [columns])

  function addColumn() {
    const id = crypto.randomUUID()
    setColumns(current => [...current, { id, title: '새 주제' }])
    setEditingColumn(id)
    setComposeColumn(id)
  }

  function composeIn(id) {
    setComposeColumn(id)
    input.current?.focus()
  }

  function renameColumn(id, title) {
    setColumns(current => current.map(column => column.id === id ? { ...column, title: title.trim() || column.title } : column))
    setEditingColumn(null)
  }

  useEffect(() => {
    try { localStorage.setItem('talkconcert-board-v1', JSON.stringify(questions)) }
    catch { setNotice('이 브라우저에서는 새로고침 후 메모를 유지할 수 없어요.') }
  }, [questions])

  function cancelDrag() {
    dragRef.current = null
    dropRef.current = null
    setDrag(null)
    setDropTarget(null)
  }

  useEffect(() => {
    const cancel = event => { if (event.key === 'Escape') cancelDrag() }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])

  function startDrag(event, item) {
    if (event.button !== 0 || drawing) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = item.id
    setDrag({ item, x: event.clientX, y: event.clientY })
    setNotice('원하는 메모 앞이나 뒤에 놓아주세요. Esc로 취소할 수 있어요.')
  }

  function dragMove(event) {
    if (!dragRef.current) return
    setDrag(current => current && ({ ...current, x: event.clientX, y: event.clientY }))
    const container = board.current
    if (container) {
      const bounds = container.getBoundingClientRect()
      if (event.clientY > bounds.bottom - 50) container.scrollTop += 16
      if (event.clientY < bounds.top + 50) container.scrollTop -= 16
      if (event.clientX > bounds.right - 60) container.scrollLeft += 18
      if (event.clientX < bounds.left + 60) container.scrollLeft -= 18
    }
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const target = element?.closest('[data-note-id]')
    const column = element?.closest('[data-column-id]')
    if (!column || target?.dataset.noteId === dragRef.current) {
      dropRef.current = null
      setDropTarget(null)
      return
    }
    const bounds = target?.getBoundingClientRect()
    const after = bounds ? event.clientY > bounds.top + bounds.height / 2 : true
    const destination = { id: target?.dataset.noteId, columnId: column.dataset.columnId, after }
    dropRef.current = destination
    setDropTarget(destination)
  }

  function finishDrag() {
    const target = dropRef.current
    if (dragRef.current && target) {
      const source = dragRef.current
      setQuestions(current => moveNote(current, source, target.id, target.after, target.columnId))
      setNotice('메모 순서를 변경했어요.')
    }
    cancelDrag()
  }

  function moveWithKeyboard(event, item) {
    const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
    if (!direction) return
    event.preventDefault()
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const nextColumn = columns[columns.findIndex(column => column.id === columnFor(item)) + direction]
      if (nextColumn) setQuestions(current => moveNote(current, item.id, null, true, nextColumn.id))
      return
    }
    const siblings = visibleQuestions.filter(note => columnFor(note) === columnFor(item))
    const destination = siblings[siblings.findIndex(note => note.id === item.id) + direction]
    if (!destination) return
    setQuestions(current => moveNote(current, item.id, destination.id, direction > 0, columnFor(item)))
    setNotice('메모 순서를 변경했어요.')
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!presenting) return
    closeButton.current?.focus()
    const onKey = event => {
      if (event.key === 'Escape') setPresenting(false)
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previewButton.current?.focus()
    }
  }, [presenting])

  function submit(event) {
    event.preventDefault()
    if (!draft.trim()) { input.current?.focus(); return }
    const item = { id: crypto.randomUUID(), columnId: composeColumn, number: Math.max(0, ...questions.map(note => note.number)) + 1, text: draft.trim(), answered: false, color, sticker, own: true }
    setQuestions(current => [item, ...current])
    setDraft('')
    setFilter('all')
    setNotice('질문이 등록됐어요.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  function draw() {
    if (drawing || waiting.length === 0) return
    const others = waiting.filter(item => item.id !== selectedId)
    const candidates = others.length ? others : waiting
    setDrawing(true)
    setNotice('질문을 뽑고 있어요.')
    timer.current = window.setTimeout(() => {
      setSelectedId(candidates[Math.floor(Math.random() * candidates.length)].id)
      setDrawing(false)
      setNotice('랜덤 질문을 선택했어요.')
    }, 650)
  }

  function complete() {
    setQuestions(current => current.map(item => item.id === selectedId ? { ...item, answered: true } : item))
    setNotice('답변 완료로 표시했어요.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="질문 추첨">
        <button className={drawing ? 'random-control drawing' : 'random-control'} onClick={draw} disabled={drawing || !waiting.length} aria-label="랜덤 질문 뽑기" title="랜덤 질문 뽑기">
          <Icon name="shuffle" size={21} />
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb"><span>TalkConcert</span><span className="slash">/</span><h1>오늘의 토크 콘서트</h1></div>
          <span className="session-label">Q&A</span>
          <div className="header-actions"><span className="count-pill"><Icon name="message" size={15} /> {questions.length}개의 질문</span><span className="demo-label">미리보기</span></div>
        </header>
        <div className="toolbar">
          <div className="view-label"><Icon name="edit" /> 질문 보드</div>
          <span className="toolbar-caption">질문을 남기고, 함께 이야기해요.</span>
          <button ref={previewButton} className="text-button preview-button" onClick={() => setPresenting(true)} disabled={!selected || drawing}><Icon name="expand" /> 크게 보기</button>
        </div>
        <main className="workspace">
          <section className="panel compose-panel" aria-labelledby="compose-heading">
            <div className="panel-header"><h2 id="compose-heading">질문 작성</h2><Icon name="edit" size={17} /></div>
            <div className="compose-content">
              <div className="context-field"><Icon name="message" size={16} /><span>오늘의 토크 콘서트</span><span className="muted">Q&A</span></div>
              <div className="welcome-copy"><p>작은 메모 한 장으로 시작해요.</p><p className="muted">색을 고르고, 궁금한 점을 남겨보세요.<br />다른 사람들의 질문도 함께 볼 수 있어요.</p></div>
            </div>
            <div className="composer-bottom">
              <form className="note-form" onSubmit={submit}>
                <label className="column-select-label" htmlFor="compose-column">질문을 붙일 곳</label>
                <select id="compose-column" className="column-select" value={composeColumn} onChange={event => setComposeColumn(event.target.value)}>{columns.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</select>
                <div className="draft-note" style={noteStyle(color)}>
                  <div className="note-author"><span className="note-sticker" aria-hidden="true">{sticker}</span><span>익명의 관객<small>내 메모 미리보기</small></span></div>
                  <label htmlFor="question" className="sr-only">질문 내용</label>
                  <textarea ref={input} id="question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={240} placeholder="지금 떠오른 질문을 여기에 적어주세요..." required />
                  <div className="draft-footer"><span>나의 질문</span><span>{draft.length} / 240</span></div>
                </div>
                <fieldset className="note-options"><legend>메모지 색</legend><div className="color-options">{noteColors.map(option => <button key={option.id} type="button" className="color-swatch" style={{ background: option.value }} aria-label={option.label} aria-pressed={color === option.id} title={option.label} onClick={() => setColor(option.id)}>{color === option.id && <Icon name="check" size={16} />}</button>)}</div></fieldset>
                <fieldset className="note-options"><legend>작은 포인트</legend><div className="sticker-options">{stickers.map(option => <button key={option} type="button" aria-label={option + ' 스티커'} aria-pressed={sticker === option} onClick={() => setSticker(option)}>{option}</button>)}</div></fieldset>
                <button type="submit" className="primary-button post-note" disabled={!draft.trim()}><Icon name="plus" size={17} /> 보드에 붙이기</button>
                <p className="notice" role="status">{notice || '로그인 없이, 익명으로 남길 수 있어요.'}</p>
              </form>
            </div>
          </section>
          <section className="panel list-panel" aria-labelledby="list-heading">
            <div className="panel-header"><h2 id="list-heading">우리의 질문 <span className="muted">({questions.length})</span></h2><button className="primary-button" onClick={addColumn}><Icon name="plus" size={16} /> 주제 추가</button></div>
            <p className="board-intro">주제 아래에 질문을 붙여보세요. 메모를 다른 주제로 옮겨도 좋아요.</p>
            <div className="filter-tabs" aria-label="질문 필터">
              {[['all', '전체'], ['waiting', '대기 중'], ['answered', '답변 완료']].map(([key, label]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
            </div>
            <div className="memo-board" ref={board}>
              <div className="shelf-board">
                {columns.map(column => <section key={column.id} data-column-id={column.id} className={'board-column' + (dropTarget?.columnId === column.id ? ' column-hover' : '')} aria-label={column.title}>
                  <div className="column-heading">
                    {editingColumn === column.id ? <input aria-label="주제 제목" autoFocus maxLength={40} defaultValue={column.title} onBlur={event => renameColumn(column.id, event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); if (event.key === 'Escape') setEditingColumn(null) }} /> : <button className="column-title" title="주제 제목 수정" onClick={() => setEditingColumn(column.id)}>{column.title}<Icon name="edit" size={12} /></button>}
                    <span>{questions.filter(item => columnFor(item) === column.id).length}</span>
                  </div>
                  <button className="column-add" onClick={() => composeIn(column.id)} aria-label={column.title + '에 질문 추가'}><Icon name="plus" size={18} /></button>
                  <div className="column-notes">
                {visibleQuestions.filter(item => columnFor(item) === column.id).map(item => <article key={item.id} data-note-id={item.id} style={noteStyle(item.color)} className={'memo-note' + (selectedId === item.id ? ' selected' : '') + (item.answered ? ' is-answered' : '') + (drag?.item.id === item.id ? ' is-dragging' : '') + (dropTarget?.id === item.id ? dropTarget.after ? ' drop-after' : ' drop-before' : '')}>
                  <div className="memo-top"><span className="note-author"><span className="note-sticker" aria-hidden="true">{item.sticker}</span><span>익명의 관객<small>{item.own ? '내 질문' : '관객 질문'}</small></span></span><button type="button" className="drag-handle" disabled={drawing} title="끌어서 순서 변경 · 방향키로 이동" aria-label={'질문 ' + item.number + ' 순서 변경, 방향키로 이동'} onPointerDown={event => startDrag(event, item)} onPointerMove={dragMove} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onKeyDown={event => moveWithKeyboard(event, item)}><Icon name="grip" /></button></div>
                  <button className="memo-read" onClick={() => setSelectedId(item.id)} disabled={drawing} aria-pressed={selectedId === item.id}>
                    <span className="memo-text">{item.text}</span>
                    <span className="memo-footer"><span>Q{String(item.number).padStart(2, '0')}</span><span className="memo-status">{item.answered ? <><Icon name="check" size={12} /> 답변 완료</> : selectedId === item.id ? '함께 읽는 중' : '답변 대기'}</span></span>
                  </button>
                </article>)}
                  </div>
                  {!visibleQuestions.some(item => columnFor(item) === column.id) && <p className="column-empty">{filter === 'all' ? '첫 질문을 붙여주세요' : '이 상태의 질문이 없어요'}</p>}
                </section>)}
                <button className="new-column" onClick={addColumn}><Icon name="plus" size={16} /> 주제 추가</button>
              </div>
              {!visibleQuestions.length && <p className="board-empty">{filter === 'answered' ? '아직 답변을 마친 질문이 없어요.' : '첫 번째 질문을 남겨주세요.'}</p>}
            </div>
            <div className="list-footer"><Icon name="grip" size={14} /> 자유롭게 순서 변경 <span>이 브라우저에 저장 · 예시 질문 포함</span></div>
          </section>
          <section className="panel detail-panel" aria-labelledby="detail-heading" aria-busy={drawing}>
            <div className="panel-header detail-header"><h2 id="detail-heading">{selected ? 'Q' + String(selected.number).padStart(2, '0') : '선택된 질문'}</h2><div className="detail-tools">{selected && !selected.answered && <button className="outline-button" disabled={drawing} onClick={complete}><Icon name="check" size={16} /> 답변 완료</button>}<span className="detail-badge"><Icon name="message" size={16} /> {selected?.answered ? '답변 완료' : '관객 질문'}</span></div></div>
            <div className="detail-content" aria-live="polite">
              <article className="question-detail">
                <div className="detail-card-heading"><h3>{drawing ? '질문을 고르는 중' : selected ? '지금 함께 나눌 질문' : '어떤 질문부터 이야기할까요?'}</h3><Icon name="message" size={18} /></div>
                <p className="detail-description">{drawing ? '대기 중인 질문에서 하나를 선택하고 있어요.' : selected ? '익명의 관객이 남긴 질문이에요.' : '목록에서 질문을 선택하거나 왼쪽 추첨 버튼을 눌러주세요.'}</p>
                <div style={selected && !drawing ? noteStyle(selected.color) : undefined} className={selected && !drawing ? 'question-display populated' : 'question-display'}>
                  {drawing ? <Icon name="shuffle" size={30} /> : selected ? <blockquote>{selected.text}</blockquote> : <><Icon name="message" size={28} /><p>아직 선택한 질문이 없어요</p></>}
                </div>
                <div className="detail-summary"><span className="status-dot" />{selected ? (selected.answered ? '답변을 마친 질문입니다.' : '질문을 읽고 현장에서 이야기를 나눠주세요.') : waiting.length + '개의 질문이 답변을 기다리고 있어요.'}</div>
              </article>
            </div>
          </section>
        </main>
      </div>
      {drag && <div className="drag-preview" style={{ ...noteStyle(drag.item.color), left: drag.x + 14, top: drag.y + 14 }} aria-hidden="true"><span>{drag.item.sticker} 질문 이동 중</span><p>{drag.item.text}</p></div>}
      {presenting && selected && <div className="presentation" role="dialog" aria-modal="true" aria-label="질문 크게 보기"><button ref={closeButton} className="close-preview outline-button" onClick={() => setPresenting(false)}><Icon name="close" /> 닫기</button><span>TalkConcert / 관객 질문</span><blockquote>{selected.text}</blockquote><p>익명의 관객</p></div>}
    </div>
  )
}
