import { useRef, useState } from 'react'
import useBoard from '../hooks/useBoard'
import { noteColors } from '../dashboardData'
import QuestionMarkdown from './QuestionMarkdown'

function QuestionForm({ item, columns, busy, onSave, onCancel }) {
  const [text, setText] = useState(item?.text || '')
  const [topic, setTopic] = useState(item?.columnId || columns[0]?.id || '')
  const [color, setColor] = useState(item?.color || 'cream')
  const id = useRef(item?.id || crypto.randomUUID())
  return <form className="cms-question-form" onSubmit={async (event) => {
    event.preventDefault()
    if (await onSave({ id: id.current, text: text.trim(), columnId: topic, color })) {
      if (!item) { setText(''); id.current = crypto.randomUUID() }
    }
  }}>
    <fieldset disabled={busy}>
      <legend>{item ? `질문 #${item.number} 수정` : '질문 추가'}</legend>
      <label>주제<select value={topic} onChange={(event) => setTopic(event.target.value)} required>
        <option value="" disabled>주제를 선택하세요</option>
        {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
      </select></label>
      <label>질문 내용<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} rows={4} required placeholder="질문 내용을 입력하세요. 마크다운도 사용할 수 있어요." /></label>
      <label>메모지 색<select value={color} onChange={(event) => setColor(event.target.value)}>
        {!noteColors.some((option) => option.id === color) && <option value={color}>직접 선택한 색</option>}
        {noteColors.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <div className="cms-actions">
        <button className="primary-button" disabled={!text.trim() || !columns.some((column) => column.id === topic)}>{busy ? '저장 중…' : item ? '수정 저장' : '질문 추가'}</button>
        {onCancel && <button type="button" className="outline-button" onClick={onCancel}>취소</button>}
      </div>
    </fieldset>
  </form>
}

function TopicRow({ column, count, disabled, onRename, onDelete }) {
  const [title, setTitle] = useState(column.title)
  return <form className="cms-topic-row" onSubmit={(event) => { event.preventDefault(); void onRename(title.trim()) }}>
    <label><span>{count}개의 질문</span><input aria-label={`${column.title} 주제 이름`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} required disabled={disabled} /></label>
    <button className="outline-button" disabled={disabled || !title.trim() || title.trim() === column.title}>이름 저장</button>
    <button type="button" className="cms-danger" disabled={disabled} onClick={onDelete}>주제 삭제</button>
  </form>
}

export default function AdminContent({ canManageTopics }) {
  const board = useBoard(true)
  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState('all')
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [target, setTarget] = useState('')
  const [notice, setNotice] = useState('')
  async function save(action, data) {
    const success = await board.mutate(action, data)
    if (success) { setNotice('Supabase에 저장했어요. 보드에 곧 반영됩니다.'); setDeleting(null) }
    return success
  }
  const live = board.questions.filter((question) => !question.deletedAt)
  const visible = board.questions.filter((question) => Boolean(question.deletedAt) === trash && (filter === 'all' || question.columnId === filter))
  return <section className="cms-content">
    <p className="admin-eyebrow">콘텐츠 관리</p><h1>주제와 질문</h1>
    <p className="admin-description">이곳에서 내용을 관리하면 진행·관객 보드에 반영됩니다.</p>
    <p className="settings-status" role="status">{board.error || notice || (board.loaded ? 'Supabase의 최신 목록입니다.' : '목록을 불러오는 중이에요…')}</p>
    <section className="cms-panel" aria-labelledby="cms-topics">
      <h2 id="cms-topics">주제 관리</h2>
      {!canManageTopics && <p>기능 설정에서 주제 관리를 ‘이용 가능’으로 바꿔 주세요.</p>}
      <form className="cms-add-topic" onSubmit={async (event) => { event.preventDefault(); if (await save('topic.create', { title: newTitle.trim() })) setNewTitle('') }}>
        <input aria-label="새 주제 이름" placeholder="예: 자유롭게 질문해요" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={40} required disabled={board.busy || !canManageTopics} />
        <button className="primary-button" disabled={board.busy || !canManageTopics || !newTitle.trim()}>주제 추가</button>
      </form>
      {board.columns.map((column) => <TopicRow key={column.id} column={column} count={live.filter((question) => question.columnId === column.id).length} disabled={board.busy || !canManageTopics}
        onRename={(title) => save('topic.update', { id: column.id, title })}
        onDelete={() => { setDeleting({ kind: 'topic', item: column }); setTarget('') }} />)}
    </section>
    <section className="cms-panel" aria-label="질문 추가">
      {board.loaded && <QuestionForm columns={board.columns} busy={board.busy} onSave={(data) => save('question.create', data)} />}
    </section>
    <section className="cms-panel" aria-labelledby="cms-questions">
      <div className="cms-list-heading"><h2 id="cms-questions">질문 목록</h2>
        <label>주제 필터<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">전체 주제</option>{board.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label>
        <button className="outline-button" onClick={() => { setTrash(!trash); setEditing(null) }}>{trash ? '등록된 질문 보기' : '삭제한 질문 보기'}</button>
      </div>
      {!visible.length && <p className="cms-empty">{trash ? '삭제한 질문이 없어요.' : '아직 등록된 질문이 없어요.'}</p>}
      {visible.map((item) => <article key={item.id} className="cms-question">
        {editing === item.id ? <QuestionForm item={item} columns={board.columns} busy={board.busy} onCancel={() => setEditing(null)} onSave={async (data) => { const ok = await save('question.update', data); if (ok) setEditing(null); return ok }} /> : <>
          <div className="cms-question-meta">#{item.number} · {board.columns.find((column) => column.id === item.columnId)?.title}</div>
          <QuestionMarkdown>{item.text}</QuestionMarkdown>
          <div className="cms-actions">{trash ? <button className="outline-button" disabled={board.busy} onClick={() => save('question.restore', { id: item.id })}>질문 복구</button> : <>
            <button className="outline-button" disabled={board.busy} onClick={() => setEditing(item.id)}>수정</button>
            <button className="cms-danger" disabled={board.busy} onClick={() => setDeleting({ kind: 'question', item })}>삭제</button>
          </>}</div>
        </>}
      </article>)}
    </section>
    {deleting && <section className="cms-confirm" role="region" aria-label="삭제 확인">
      <h2>{deleting.kind === 'topic' ? `‘${deleting.item.title}’ 주제 삭제` : `질문 #${deleting.item.number} 삭제`}</h2>
      {deleting.kind === 'topic' ? <>
        <p>질문은 삭제하지 않고 선택한 주제로 옮깁니다. 마지막 주제는 삭제할 수 없어요.</p>
        <label>질문을 옮길 주제<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">주제 선택</option>{board.columns.filter((column) => column.id !== deleting.item.id).map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label>
      </> : <p>진행·관객 보드에서 숨겨집니다. CMS의 ‘삭제한 질문 보기’에서 복구할 수 있어요.</p>}
      <div className="cms-actions"><button className="cms-danger" disabled={board.busy || (deleting.kind === 'topic' && (!target || board.columns.length <= 1))} onClick={() => save(`${deleting.kind}.delete`, { id: deleting.item.id, ...(deleting.kind === 'topic' ? { targetId: target } : {}) })}>삭제 확인</button><button className="outline-button" disabled={board.busy} onClick={() => setDeleting(null)}>취소</button></div>
    </section>}
  </section>
}
