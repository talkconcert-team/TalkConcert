import { useEffect, useRef, useState } from 'react'
import { adminHeaders } from '../../lib/adminAuth'
import { createSlotDraw } from '../slotDraw'
import { presentationSelection } from '../presentationSelection'

const pendingKey = 'talkconcert-pending-draw'
const exhausted = '모든 질문을 한 번씩 뽑았어요. 새 질문이 등록되면 다시 추첨할 수 있어요.'

async function drawRequest(requestId) {
  const response = await fetch('/api/admin/draw', {
    method: requestId ? 'POST' : 'GET',
    headers: { ...await adminHeaders(), ...(requestId ? { 'Content-Type': 'application/json' } : {}) },
    ...(requestId ? { body: JSON.stringify({ requestId }) } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(data?.remainingIds)) {
    const error = new Error(data?.error || '추첨 결과를 확인하지 못했어요. 다시 시도해 주세요.')
    error.status = response.status
    throw error
  }
  return data
}

function readPending() {
  try { return sessionStorage.getItem(pendingKey) } catch { return null }
}

// 응답이 끊겨도 같은 요청 ID를 재사용해, 보이지 않은 당첨자를 추가로 소비하지 않는다.
export default function useQuestionDraw({ canDraw, questions, setNotice }) {
  const [state, setState] = useState(null)
  const [selected, setSelected] = useState(null)
  const [presenting, setPresenting] = useState(false)
  const [slot, setSlot] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [pendingId, setPendingId] = useState(readPending)
  const activeDraw = useRef(null)
  const inFlight = useRef(false)
  const version = useRef(0)
  const mounted = useRef(false)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!canDraw) return
    let active = true
    let polling = false
    const refresh = async () => {
      if (polling || inFlight.current) return
      polling = true
      const revision = version.current
      try {
        const data = await drawRequest()
        if (!active || revision !== version.current) return
        setState(data)
        setSelected((current) => current || (data.latest ? { mode: 'draw', question: data.latest.question } : null))
      } catch (error) { if (active && revision === version.current) setNotice(error.message) }
      finally { polling = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [canDraw, setNotice])

  async function draw() {
    if (!canDraw || inFlight.current || activeDraw.current || (!pendingId && !state?.remainingIds.length)) return
    inFlight.current = true
    version.current += 1
    setRequesting(true)
    try {
      const requestId = pendingId || crypto.randomUUID()
      // 저장에 실패하면 서버를 호출하지 않는다. 새로고침 뒤에도 미확인 요청을 복구한다.
      sessionStorage.setItem(pendingKey, requestId)
      setPendingId(requestId)
      setNotice('추첨 결과를 저장하고 있어요…')
      const data = await drawRequest(requestId)
      if (!mounted.current) return
      setState(data)
      sessionStorage.removeItem(pendingKey)
      setPendingId(null)
      if (!data.draw) { setNotice(exhausted); return }
      // 예전 슬롯처럼 전체 보드를 굴리되, 마지막 당첨자만 DB의 미추첨 결과로 고정한다.
      const nextSlot = createSlotDraw(questions, data.draw.question)
      nextSlot.requestId = data.draw.requestId
      activeDraw.current = nextSlot
      setSelected({ mode: 'draw', question: data.draw.question })
      setSlot(nextSlot)
      setPresenting(true)
      setNotice('질문을 뽑고 있어요. 결과는 저장되었어요.')
    } catch (error) {
      if (mounted.current) {
        // 명시적으로 거부한 요청은 당첨을 생성하지 않았으므로 새 요청이 가능하다.
        if ([400, 401, 403, 409].includes(error.status)) {
          try { sessionStorage.removeItem(pendingKey) } catch { /* 같은 ID로 재시도해도 안전하다. */ }
          setPendingId(null)
        }
        setNotice(`${error.status ? error.message : '추첨 서버 응답을 확인하지 못했어요.'} 결과가 확인되지 않았다면 추첨 버튼을 다시 눌러 주세요.`)
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setRequesting(false)
    }
  }

  function finishDraw() {
    if (!activeDraw.current) return
    activeDraw.current = null
    setSlot(null)
    setNotice('질문을 선택했어요. 이 질문은 다음 추첨에서 제외돼요.')
  }

  function closePresentation() {
    // 닫아도 DB 당첨 이력은 유지한다. 결과는 헤더에서 다시 크게 볼 수 있다.
    if (activeDraw.current) setNotice('추첨 결과가 저장되었어요. 선택된 질문을 다시 크게 볼 수 있어요.')
    activeDraw.current = null
    setSlot(null)
    setPresenting(false)
  }

  function openQuestion(id) {
    if (inFlight.current || activeDraw.current) return
    const question = questions.find((item) => item.id === id)
    setSelected(question ? { mode: 'board', question } : null)
    setPresenting(true)
  }

  return {
    selected: presentationSelection(selected, questions), selectedId: presentationSelection(selected, questions)?.id || null, presenting, setPresenting,
    drawing: requesting || slot !== null, slot, finishDraw, closePresentation, openQuestion, draw,
    drawAvailable: Boolean(pendingId || state?.remainingIds.length),
    drawExhausted: Boolean(state && !pendingId && !state.remainingIds.length),
    drawHint: pendingId ? '미확인 추첨 결과 다시 확인' : state ? (state.remainingIds.length ? `남은 질문 ${state.remainingIds.length}개 · 한 번씩만 추첨` : questions.length ? exhausted : '아직 등록된 질문이 없어요.') : '추첨 이력을 불러오고 있어요.',
  }
}
