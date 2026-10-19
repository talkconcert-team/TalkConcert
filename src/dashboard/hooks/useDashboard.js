import { useEffect, useRef, useState } from 'react'
import useQuestionDraw from './useQuestionDraw'
import useBoard from './useBoard'
import { syncQuestionOwnership } from '../questionOwnership'
import { supabase } from '../../lib/supabase'
import { checkAdmin, checkAudience, signInWithGoogle } from '../../lib/adminAuth'
import { questionNickname } from '../questionNickname'
import { withTimeout } from '../../lib/requestTimeout'

function loadComposeIntent() {
  try { return JSON.parse(sessionStorage.getItem('talkconcert-compose-intent') || 'null') || {} } catch { return {} }
}

// 작성·본인 메모 이동·추첨을 DB에 연결한다. 본문 수정·삭제와 주제 관리는 CMS에서 한다.
export default function useDashboard({ canDraw = false, isPresenter = false } = {}) {
  const [notice, setNotice] = useState('')
  const remote = useBoard()
  const { columns } = remote
  const [ownership, setOwnership] = useState({ userId: null, ids: [] })
  const ownershipRevision = useRef(0)
  const [session, setSession] = useState(supabase ? undefined : null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [audienceAdmin, setAudienceAdmin] = useState(false)
  const canManageMoves = isPresenter || audienceAdmin
  const owns = (id) => Boolean(session?.user.id && ownership.userId === session.user.id && ownership.ids.includes(id))
  const questions = remote.questions.map((item) => ({ ...item, own: owns(item.id), movable: Boolean(session) && (canManageMoves || owns(item.id)) }))
  useEffect(() => {
    if (!supabase) return
    let active = true
    let revision = 0
    const verify = async () => {
      const current = ++revision
      const ownedVersion = ownershipRevision.current
      let allowed = false
      try {
        const { data, error } = await withTimeout(() => supabase.auth.getSession())
        if (error) throw new Error('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.')
        if (!active || current !== revision) return
        setSession(data.session)
        if (data.session) {
          const [admin, owned] = await Promise.allSettled([checkAdmin(), syncQuestionOwnership()])
          allowed = admin.status === 'fulfilled'
          if (active && current === revision) {
            if (owned.status === 'fulfilled') {
              // 새 질문 등록 전에 시작한 조회가 등록 직후의 '내 질문' 표시를 지우지 않게 한다.
              if (ownedVersion === ownershipRevision.current) setOwnership({ userId: data.session.user.id, ids: owned.value })
            } else setNotice(owned.reason.message)
          }
        } else setOwnership({ userId: null, ids: [] })
      } catch (error) { if (active && current === revision) setNotice(error.message) }
      if (active && current === revision) setAudienceAdmin(allowed)
    }
    void verify()
    // 인증 콜백 밖에서 검증해 Supabase 세션 처리와 충돌하지 않게 한다.
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      if (!active) return
      revision += 1
      setSession(value)
      setAudienceAdmin(false)
      setTimeout(verify, 0)
    })
    window.addEventListener('focus', verify)
    const timer = window.setInterval(verify, 30000)
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('focus', verify); window.clearInterval(timer) }
  }, [isPresenter])
  const [preferredColumn, setComposeColumn] = useState(() => loadComposeIntent().columnId || '')
  const composeColumn = columns.some((column) => column.id === preferredColumn) ? preferredColumn : (columns[0]?.id || '')
  const pendingSubmission = useRef(null)
  const [draft, setDraft] = useState(() => loadComposeIntent().draft || '')
  const [color, setColor] = useState(() => loadComposeIntent().color || 'cream')
  const presentation = useQuestionDraw({ canDraw, questions, setNotice })
  const input = useRef(null)
  const board = useRef(null)
  // 예전 저장 데이터에 주제가 없거나 현재 열과 맞지 않으면 첫 번째 열에 표시한다.
  const columnFor = (item) =>
    columns.some((column) => column.id === item.columnId)
      ? item.columnId
      : columns[0]?.id

  function composeIn(id) {
    setComposeColumn(id)
    if (!session) { void requestLogin(id); return }
    input.current?.focus()
  }

  async function requestLogin(columnId = composeColumn) {
    if (loggingIn) return
    setLoggingIn(true)
    try {
      sessionStorage.setItem('talkconcert-compose-intent', JSON.stringify({ columnId, color, draft }))
      await signInWithGoogle('/')
    } catch (error) { setNotice(error.message); setLoggingIn(false) }
  }

  useEffect(() => {
    if (!session || !remote.loaded || !sessionStorage.getItem('talkconcert-compose-intent')) return
    sessionStorage.removeItem('talkconcert-compose-intent')
    input.current?.focus()
  }, [session, remote.loaded])

  async function submit(event) {
    event.preventDefault()
    const submittingUserId = session?.user.id
    if (!submittingUserId) { void requestLogin(); return }
    // 만료된 세션도 제출 직전에 확인한다. 질문 원문은 자동 전송하지 않는다.
    try { await checkAudience() } catch (error) {
      if (!session || error.status === 401 || error.status === 403) { void requestLogin(); return }
      setNotice(error.message); return
    }
    if (!draft.trim() || !composeColumn || remote.busy) {
      input.current?.focus()
      return
    }
    const fingerprint = JSON.stringify([submittingUserId, composeColumn, draft.trim(), color])
    if (pendingSubmission.current?.fingerprint !== fingerprint) pendingSubmission.current = { fingerprint, id: crypto.randomUUID() }
    const item = {
      id: pendingSubmission.current.id,
      columnId: composeColumn,
      text: draft.trim(),
      color,
      authorName: questionNickname(session?.user),
    }
    if (!await remote.mutate('question.create', item)) return
    ownershipRevision.current += 1
    setOwnership((current) => ({ userId: submittingUserId, ids: [...(current.userId === submittingUserId ? current.ids : []), item.id] }))
    pendingSubmission.current = null
    setDraft((current) => current === draft ? '' : current)
    setNotice('질문을 등록했어요.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  async function moveQuestion(id, destination) {
    if (!session) { void requestLogin(); return false }
    if (remote.busy || (!canManageMoves && !owns(id))) return false
    setNotice('메모 위치를 저장하고 있어요…')
    const saved = await remote.mutate('question.move', {
      id, columnId: destination.columnId, targetId: destination.id || null,
      after: Boolean(destination.after),
    }, { asAdmin: canManageMoves })
    if (saved) {
      setNotice('메모 위치를 저장했어요.')
      requestAnimationFrame(() => {
        const handle = board.current?.querySelector(`[data-note-id="${id}"] .drag-handle`)
        handle?.focus({ preventScroll: true })
        handle?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    }
    return saved
  }

  return {
    questions,
    user: session?.user,
    canManageMoves,
    signedIn: Boolean(session),
    accountEmail: session?.user.email || '',
    loggingIn,
    requestLogin,
    columns,
    composeColumn,
    setComposeColumn,
    draft,
    setDraft,
    color,
    setColor,
    ...presentation,
    notice: remote.error || notice,
    error: remote.error,
    busy: remote.busy,
    loaded: remote.loaded,
    setNotice,
    input,
    board,
    columnFor,
    moveQuestion,
    composeIn,
    submit,
  }
}
