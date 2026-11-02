import { useEffect, useRef, useState } from 'react'
import { MessageCircle, RotateCw } from 'lucide-react'
import { commentsRequest, loadCommentDraft, saveCommentDraft, mergeComments } from '../answerComments'
import { loadAudienceName } from '../audienceName'
import { getLikeVisitor } from '../answerLikes'

function CommentThread({ answerId, readOnly }) {
  const [comments, setComments] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(() => loadCommentDraft(answerId))
  const [name] = useState(() => draft.authorName || loadAudienceName())
  const pending = useRef(draft)
  const writing = useRef(false)
  const reading = useRef(false)
  const alive = useRef(false)

  useEffect(() => {
    let active = true
    alive.current = true
    commentsRequest('list', answerId).then((result) => {
      if (active) { setComments(result.comments); setHasMore(result.hasMore); setLoaded(true) }
    }).catch((err) => { if (active) setError(err.message) })
    return () => { active = false; alive.current = false }
  }, [answerId])

  async function refresh(older = false) {
    if (reading.current || writing.current) return
    reading.current = true
    setLoading(true)
    setError('')
    try {
      const result = await commentsRequest('list', answerId, older && comments.length ? { before: comments[0].cursor } : {})
      if (alive.current) {
        setComments((current) => older ? mergeComments(current, result.comments) : result.comments)
        setHasMore(result.hasMore)
        setLoaded(true)
      }
    } catch (err) { if (alive.current) setError(err.message) }
    finally { reading.current = false; if (alive.current) setLoading(false) }
  }

  async function submit(event) {
    event.preventDefault()
    const text = draft.text.trim()
    if (!text || writing.current || reading.current || !loaded) return
    writing.current = true
    setPosting(true)
    setError('')
    setNotice('')
    try {
      let visitorToken
      try { visitorToken = getLikeVisitor() } catch { throw new Error('댓글을 남기려면 브라우저의 사이트 데이터 저장을 허용해 주세요.') }
      // 같은 내용의 재시도에는 저장해 둔 ID를 사용해 응답 유실에도 중복 등록하지 않는다.
      if (pending.current.text?.trim() !== text || !pending.current.id) pending.current = { id: crypto.randomUUID(), text, authorName: name }
      saveCommentDraft(answerId, pending.current)
      const comment = await commentsRequest('create', answerId, { ...pending.current, text, visitorToken })
      const savedDraft = loadCommentDraft(answerId)
      if (savedDraft.id === pending.current.id && savedDraft.text.trim() === text) saveCommentDraft(answerId, null)
      if (alive.current) {
        setComments((current) => mergeComments(current, [comment]))
        pending.current = { text: '' }
        setDraft({ text: '' })
        setNotice('댓글을 남겼어요.')
      }
    } catch (err) { if (alive.current) setError(err.message) }
    finally { writing.current = false; if (alive.current) setPosting(false) }
  }

  return <section className="answer-comments" aria-label="익명 댓글">
    <div className="comments-heading"><h4>댓글</h4><button type="button" className="comments-refresh" disabled={loading || posting || (!loaded && !error)} onClick={() => refresh()} aria-label="댓글 새로고침"><RotateCw size={14} aria-hidden="true" /> 새로고침</button></div>
    {hasMore && <button className="comments-older" disabled={loading || posting} onClick={() => refresh(true)}>이전 댓글 더 보기</button>}
    {!loaded && !error && <p className="comments-empty" role="status">댓글을 불러오고 있어요…</p>}
    {loaded && !comments.length && <p className="comments-empty">첫 댓글을 남겨보세요.</p>}
    <ol className="comment-list">{comments.map((comment) => <li key={comment.id} className="answer-comment">
      <div><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</time></div>
      <p>{comment.text}</p>
    </li>)}</ol>
    {!readOnly && <form className="comment-form" onSubmit={submit}>
      <label htmlFor={`comment-${answerId}`}>{name}</label>
      <textarea id={`comment-${answerId}`} placeholder="답변에 대한 생각이나 궁금한 점을 남겨주세요." value={draft.text} maxLength={1000} rows={2} disabled={posting} onChange={(event) => {
        const next = { text: event.target.value, authorName: name }
        setDraft(next)
        saveCommentDraft(answerId, next.text.trim() === pending.current.text?.trim() ? { ...pending.current, text: next.text } : next)
      }} />
      <div className="comment-form-footer"><small>{draft.text.length} / 1000</small><button className="primary-button" disabled={!draft.text.trim() || posting || loading || !loaded}>{posting ? '등록 중…' : '댓글 남기기'}</button></div>
    </form>}
    {error && <p className="comment-error" role="alert">{error}</p>}
    {notice && <p className="comment-notice" role="status">{notice}</p>}
  </section>
}

// 관리 목록에서는 펼친 답변만 조회해 전체 답변 수만큼 요청하지 않는다.
export default function AnswerComments({ answerId, readOnly = false }) {
  const [open, setOpen] = useState(!readOnly)
  return <>
    {readOnly && <button type="button" className="comments-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><MessageCircle size={15} aria-hidden="true" />{open ? '댓글 접기' : '댓글 보기'}</button>}
    {open && <CommentThread key={answerId} answerId={answerId} readOnly={readOnly} />}
  </>
}
