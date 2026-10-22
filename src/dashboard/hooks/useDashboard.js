import { useEffect, useRef, useState } from 'react'
import useQuestionDraw from './useQuestionDraw'
import useBoard from './useBoard'
import { loadNoteOwners, rememberNoteOwner } from '../noteOwnership'
import { loadAudienceName } from '../audienceName'
import { supabase } from '../../lib/supabase'
import { checkAdmin } from '../../lib/adminAuth'
import { withTimeout } from '../../lib/requestTimeout'
import { loadComposeIntent, saveComposeIntent, loadPendingQuestion, savePendingQuestion } from '../composeStorage'

// 로그인 없이 작성하고, 브라우저의 비밀 토큰으로 본인 메모 이동만 허용한다. 본문 수정·삭제와 주제 관리는 CMS에서 한다.
export default function useDashboard({ canDraw = false, isPresenter = false } = {}) {
  const [notice, setNotice] = useState('')
  const remote = useBoard()
  const { columns } = remote
  const [owners, setOwners] = useState(loadNoteOwners)
  const [authorName] = useState(loadAudienceName)
  const [session, setSession] = useState(supabase ? undefined : null)
  const [audienceAdmin, setAudienceAdmin] = useState(false)
  const canManageMoves = isPresenter || audienceAdmin
  const owns = (id) => Boolean(owners[id])
  const questions = remote.questions.map((item) => ({ ...item, own: owns(item.id), movable: canManageMoves || owns(item.id) }))
  useEffect(() => {
    if (!supabase || !isPresenter) return
    let active = true
    let revision = 0
    const verify = async () => {
      const current = ++revision
      let allowed = false
      try {
        const { data, error } = await withTimeout(() => supabase.auth.getSession())
        if (error) throw new Error('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.')
        if (!active || current !== revision) return
        setSession(data.session)
        if (data.session) {
          await checkAdmin()
          allowed = true
        }
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
  const pendingSubmission = useRef(loadPendingQuestion())
  const submitting = useRef(false)
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState(() => loadComposeIntent().draft || '')
  const [color, setColor] = useState(() => loadComposeIntent().color || 'cream')
  useEffect(() => {
    if (!isPresenter) saveComposeIntent({ columnId: preferredColumn, draft, color })
  }, [preferredColumn, draft, color, isPresenter])
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
    input.current?.focus()
  }

  async function submit(event) {
    event.preventDefault()
    if (!draft.trim() || !composeColumn || remote.busy || submitting.current) {
      input.current?.focus()
      return
    }
    const fingerprint = JSON.stringify([composeColumn, draft.trim(), color, authorName])
    if (pendingSubmission.current?.fingerprint !== fingerprint) pendingSubmission.current = { fingerprint, id: crypto.randomUUID() }
    let ownerToken
    try {
      const saved = rememberNoteOwner(pendingSubmission.current.id, undefined, pendingSubmission.current.token || owners[pendingSubmission.current.id])
      ownerToken = saved.token
      pendingSubmission.current.token = ownerToken
      setOwners((current) => ({ ...current, ...saved.owners }))
    } catch {
      // 저장소가 차단되어도 참여를 막지 않는다. 현재 화면에서만 작성자 이동 권한을 유지한다.
      pendingSubmission.current.token ||= owners[pendingSubmission.current.id] || Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
      ownerToken = pendingSubmission.current.token
      const id = pendingSubmission.current.id
      setOwners((current) => ({ ...current, [id]: ownerToken }))
    }
    const item = {
      authorName,
      ownerToken,
      id: pendingSubmission.current.id,
      columnId: composeColumn,
      text: draft.trim(),
      color,
    }
    savePendingQuestion(pendingSubmission.current)
    submitting.current = true
    setPosting(true)
    setNotice('질문을 등록하고 있어요…')
    let saved
    try { saved = await remote.mutate('question.create', item) }
    finally { submitting.current = false; setPosting(false) }
    if (!saved) { setNotice('등록을 완료하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.'); return }
    pendingSubmission.current = null
    savePendingQuestion(null)
    setDraft((current) => current === draft ? '' : current)
    setNotice('질문을 등록했어요.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  async function moveQuestion(id, destination) {
    if (remote.busy || (!canManageMoves && !owns(id))) return false
    setNotice('메모 위치를 저장하고 있어요…')
    const saved = await remote.mutate('question.move', {
      id, ownerToken: owners[id], columnId: destination.columnId, targetId: destination.id || null,
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
    canManageMoves,
    signedIn: Boolean(session),
    accountEmail: session?.user.email || '',
    authorName,
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
    posting,
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
