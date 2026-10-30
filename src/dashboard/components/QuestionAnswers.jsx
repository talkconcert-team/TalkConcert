import { useState } from 'react'

// 답변은 일반 텍스트로 표시해 입력한 줄바꿈을 보존하고 HTML 실행을 막는다.
export default function QuestionAnswers({ answers = [] }) {
  if (!answers.length) return null
  return <section className="question-answers" aria-label="관리자 답변">
    <h3>선배들의 답변 <span>{answers.length}</span></h3>
    {answers.map((answer) => <article className="question-answer" key={answer.authorName}>
      <div className="answer-author"><span aria-hidden="true">{answer.authorName.slice(0, 1)}</span><strong>{answer.authorName}</strong><small>관리자</small></div>
      <p>{answer.text}</p>
    </article>)}
  </section>
}

function AnswerForm({ question, busy, onSave, onCancel }) {
  const own = question.answers?.find((answer) => answer.mine)
  const [text, setText] = useState(own?.text || '')
  const [error, setError] = useState('')
  return <form className="answer-form" onSubmit={async (event) => {
    event.preventDefault()
    if (busy || !text.trim()) return
    setError('')
    if (await onSave({ id: question.id, text: text.trim() })) onCancel()
    else setError('답변을 저장하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.')
  }}>
    <label htmlFor={`answer-${question.id}`}>내 답변</label>
    <textarea id={`answer-${question.id}`} value={text} onChange={(event) => setText(event.target.value)} placeholder="질문에 대한 답변을 남겨 주세요." rows={4} maxLength={4000} required disabled={busy} />
    <div className="answer-form-footer"><small>{text.length} / 4000 · 로그인한 관리자 이름으로 등록됩니다.</small>
      <div className="cms-actions"><button type="button" className="outline-button" onClick={onCancel} disabled={busy}>취소</button><button className="primary-button" disabled={busy || !text.trim()}>{busy ? '저장 중…' : '답변 저장'}</button></div>
    </div>
    {error && <p role="alert">{error}</p>}
  </form>
}

export function AdminQuestionAnswers({ question, available, busy, onSave }) {
  const [editing, setEditing] = useState(false)
  const own = question.answers?.find((answer) => answer.mine)
  return <div className="admin-question-answers">
    <QuestionAnswers answers={question.answers} />
    {editing ? <AnswerForm question={question} busy={busy} onSave={onSave} onCancel={() => setEditing(false)} />
      : <button className="outline-button" disabled={busy || !available} onClick={() => setEditing(true)}>{own ? '내 답변 수정' : '답변 작성'}</button>}
    {!available && <p className="answer-unavailable">답변 기능 준비 중입니다.</p>}
  </div>
}
