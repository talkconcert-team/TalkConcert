import { useEffect, useRef, useState } from 'react'
import { answerLikesRequest, getLikeVisitor, visitorKey } from '../answerLikes'

// 크게 보기에 열린 답변만 조회한다. CMS의 모든 답변마다 별도 요청을 만들지 않는다.
export default function useAnswerLikes(answers, enabled) {
  const idsKey = answers.map((answer) => answer.answerId).filter(Boolean).sort().join(',')
  const [states, setStates] = useState({})
  const [pending, setPending] = useState({})
  const [error, setError] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const loading = Boolean(enabled && idsKey && loadedKey !== idsKey)
  const writing = useRef(new Set())
  const alive = useRef(false)
  const generation = useRef(0)
  const apply = (rows) => setStates((current) => {
    const next = { ...current }
    for (const row of rows) next[row.answerId] = { ...row, likes: Math.max(row.likes, current[row.answerId]?.likes || 0), liked: row.liked || current[row.answerId]?.liked || false }
    return next
  })

  useEffect(() => {
    if (!enabled || !idsKey) return
    let active = true
    let reading = false
    alive.current = true
    const refresh = async () => {
      if (reading || writing.current.size) return
      reading = true
      const started = generation.current
      try {
        const token = getLikeVisitor()
        const rows = await answerLikesRequest('status', idsKey.split(','), token)
        if (active && generation.current === started) { apply(rows); setError('') }
      } catch (err) { if (active && generation.current === started) setError(err.message) }
      finally { reading = false; if (active) setLoadedKey(idsKey) }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5000)
    const storageChanged = (event) => { if (event.key === visitorKey) { setStates({}); void refresh() } }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', storageChanged)
    return () => { active = false; alive.current = false; generation.current += 1; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', storageChanged) }
  }, [enabled, idsKey])

  async function like(answerId) {
    if (!enabled || !answerId || loading || states[answerId]?.liked || writing.current.size > 0) return
    writing.current.add(answerId)
    const started = ++generation.current
    setPending((current) => ({ ...current, [answerId]: true }))
    setError('')
    try {
      const token = getLikeVisitor()
      const rows = await answerLikesRequest('like', [answerId], token)
      if (alive.current && generation.current === started) apply(rows)
    } catch (err) { if (alive.current) setError(err.message) }
    finally {
      writing.current.delete(answerId)
      if (alive.current) setPending((current) => ({ ...current, [answerId]: false }))
    }
  }
  return { states, pending, error, loading, busy: Object.values(pending).some(Boolean), like }
}
