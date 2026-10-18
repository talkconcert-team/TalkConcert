import { useEffect, useRef, useState } from 'react'
import { sessionHeaders } from '../../lib/adminAuth'
import { requestJson } from '../../lib/requestTimeout'

export async function boardRequest(admin, action, data) {
  const headers = admin || action ? await sessionHeaders() : {}
  const { response, data: result } = await requestJson(admin ? '/api/admin/board' : '/api/board', {
    cache: 'no-store',
    headers: { ...headers, ...(action ? { 'Content-Type': 'application/json' } : {}) },
    ...(action ? { method: 'POST', body: JSON.stringify({ action, data }) } : {}),
  })
  if (!response.ok || !Array.isArray(result?.columns) || !Array.isArray(result?.questions)) throw new Error(result?.error || '질문 보드를 불러오지 못했어요.')
  return result
}

// CMS와 관객·진행 화면이 같은 DB 데이터를 읽는다. 작성 중인 폼은 조회 갱신으로 덮어쓰지 않는다.
export default function useBoard(admin = false) {
  const [data, setData] = useState({ columns: [], questions: [] })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const version = useRef(0)
  const alive = useRef(false)
  useEffect(() => {
    let active = true
    alive.current = true
    let pending = false
    const refresh = async () => {
      if (pending || writing.current) return
      pending = true
      const started = version.current
      try {
        const snapshot = await boardRequest(admin)
        if (active && started === version.current) { setData(snapshot); setLoaded(true); setError('') }
      } catch (err) {
        if (active && started === version.current) setError(err.message)
      } finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    window.addEventListener('talkconcert-board-changed', refresh)
    return () => {
      active = false
      alive.current = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('talkconcert-board-changed', refresh)
    }
  }, [admin])

  async function mutate(action, payload, { asAdmin = admin } = {}) {
    if (writing.current) return false
    writing.current = true
    version.current += 1
    setBusy(true)
    setError('')
    try {
      const snapshot = await boardRequest(asAdmin, action, payload)
      if (!alive.current) return false
      setData(snapshot)
      window.dispatchEvent(new Event('talkconcert-board-changed'))
      return true
    } catch (err) {
      if (alive.current) setError(err.message)
      return false
    } finally {
      writing.current = false
      if (alive.current) setBusy(false)
    }
  }
  return { ...data, loaded, error, busy, mutate }
}
