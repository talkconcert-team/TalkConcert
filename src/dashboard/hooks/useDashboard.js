import { useEffect, useRef, useState } from 'react'
import { createSlotDraw } from '../slotDraw'
import useBoard from './useBoard'
import { loadNoteOwners, rememberNoteOwner } from '../noteOwnership'
import { supabase } from '../../lib/supabase'
import { checkAdmin, checkAudience, signInWithGoogle } from '../../lib/adminAuth'
import { questionNickname } from '../questionNickname'
import { notifyError, notifySuccess } from '../../lib/toast'

function loadComposeIntent() {
  try { return JSON.parse(sessionStorage.getItem('talkconcert-compose-intent') || 'null') || {} } catch { return {} }
}

// 작성·본인 메모 이동·추첨을 DB에 연결한다. 본문 수정·삭제와 주제 관리는 CMS에서 한다.
export default function useDashboard({ canDraw = false, isPresenter = false } = {}) {
  const [notice, setNotice] = useState('')
  const remote = useBoard()
  const { columns } = remote
  const [owners, setOwners] = useState(loadNoteOwners)
  const [session, setSession] = useState(supabase ? undefined : null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [audienceAdmin, setAudienceAdmin] = useState(false)
  const canManageMoves = isPresenter || audienceAdmin
  const questions = remote.questions.map((item) => ({ ...item, own: Boolean(owners[item.id]), movable: Boolean(session) && (canManageMoves || Boolean(owners[item.id])) }))
  useEffect(() => {
    if (!supabase) return
    let active = true
    let revision = 0
    const verify = async () => {
      const current = ++revision
      let allowed = false
      try {
        const { data } = await supabase.auth.getSession()
        if (active) setSession(data.session)
        if (data.session) { await checkAdmin(); allowed = true }
      } catch { /* 일반 관객은 관리자 권한 없이 본인 메모를 이동한다. */ }
      if (active && current === revision) setAudienceAdmin(allowed)
    }
    void verify()
    // 인증 콜백 밖에서 검증해 Supabase 세션 처리와 충돌하지 않게 한다.
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { if (active) setSession(value); setTimeout(verify, 0) })
    window.addEventListener('focus', verify)
    const timer = window.setInterval(verify, 30000)
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('focus', verify); window.clearInterval(timer) }
  }, [isPresenter])
  useEffect(() => {
    const sync = (event) => { if (event.key === 'talkconcert-note-owners-v1' || event.key === null) setOwners(loadNoteOwners()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const [preferredColumn, setComposeColumn] = useState(() => loadComposeIntent().columnId || '')
  const composeColumn = columns.some((column) => column.id === preferredColumn) ? preferredColumn : (columns[0]?.id || '')
  const pendingSubmission = useRef(null)
  const [draft, setDraft] = useState(() => loadComposeIntent().draft || '')
  const [color, setColor] = useState(() => loadComposeIntent().color || 'cream')
  const [selectedId, setSelectedId] = useState(null)
  const [presenting, setPresenting] = useState(false)
  const [slot, setSlot] = useState(null)
  const drawing = slot !== null
  const activeDraw = useRef(null)
  const input = useRef(null)
  const board = useRef(null)
  const selected = questions.find((item) => item.id === selectedId)
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
    } catch (error) { setNotice(error.message); notifyError(error.message); setLoggingIn(false) }
  }

  useEffect(() => {
    if (!session || !remote.loaded || !sessionStorage.getItem('talkconcert-compose-intent')) return
    sessionStorage.removeItem('talkconcert-compose-intent')
    input.current?.focus()
  }, [session, remote.loaded])

  async function submit(event) {
    event.preventDefault()
    // 만료된 세션도 제출 직전에 확인한다. 질문 원문은 자동 전송하지 않는다.
    try { await checkAudience() } catch (error) {
      if (!session || error.status === 401 || error.status === 403) { void requestLogin(); return }
      setNotice(error.message); notifyError(error.message); return
    }
    if (!draft.trim() || !composeColumn || remote.busy) {
      input.current?.focus()
      return
    }
    const fingerprint = JSON.stringify([composeColumn, draft.trim(), color])
    if (pendingSubmission.current?.fingerprint !== fingerprint) pendingSubmission.current = { fingerprint, id: crypto.randomUUID() }
    const item = {
      id: pendingSubmission.current.id,
      columnId: composeColumn,
      text: draft.trim(),
      color,
      authorName: questionNickname(session?.user),
    }
    try {
      const saved = rememberNoteOwner(item.id)
      item.ownerToken = saved.token
      setOwners(saved.owners)
    } catch {
      const message = '작성자 정보를 저장하지 못했어요. 브라우저 저장소를 허용한 뒤 다시 등록해 주세요.'
      setNotice(message)
      notifyError(message)
      return
    }
    if (!await remote.mutate('question.create', item)) return
    pendingSubmission.current = null
    setDraft((current) => current === draft ? '' : current)
    setNotice('질문이 Supabase에 등록됐어요.')
    notifySuccess('질문이 업로드되었습니다.')
    board.current?.scrollTo({ top: 0, behavior: 'smooth' })
    input.current?.focus()
  }

  async function moveQuestion(id, destination) {
    if (!session) { void requestLogin(); return false }
    if (remote.busy || (!canManageMoves && !owners[id])) return false
    setNotice('메모 위치를 저장하고 있어요…')
    const saved = await remote.mutate('question.move', {
      id, columnId: destination.columnId, targetId: destination.id || null,
      after: Boolean(destination.after), ownerToken: owners[id],
    }, { asAdmin: canManageMoves })
    if (saved) {
      setNotice('메모 위치를 Supabase에 저장했어요.')
      requestAnimationFrame(() => {
        const handle = board.current?.querySelector(`[data-note-id="${id}"] .drag-handle`)
        handle?.focus({ preventScroll: true })
        handle?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    }
    return saved
  }

  function draw() {
    if (!canDraw || activeDraw.current || questions.length === 0) return
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
    user: session?.user,
    canManageMoves,
    signedIn: Boolean(session),
    loggingIn,
    requestLogin,
    columns,
    composeColumn,
    setComposeColumn,
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
    notice: remote.error || notice,
    error: remote.error,
    busy: remote.busy,
    loaded: remote.loaded,
    setNotice,
    input,
    board,
    selected,
    columnFor,
    moveQuestion,
    composeIn,
    submit,
    draw,
  }
}
