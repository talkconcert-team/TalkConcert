import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkAdmin, signInWithGoogle } from '../lib/adminAuth'

// 별도 로그인 화면을 만들지 않고 관리 주소에서 Google 인증으로 바로 이동한다.
export default function GoogleGate({ children }) {
  const [session, setSession] = useState(undefined)
  const [phase, setPhase] = useState(supabase ? 'checking' : 'error')
  const [message, setMessage] = useState(supabase ? '' : 'Supabase 로그인 연결 정보를 확인해 주세요.')
  const [approvedToken, setApprovedToken] = useState('')
  const starting = useRef(false)

  const startLogin = useCallback(async () => {
    if (starting.current) return
    starting.current = true
    setMessage('')
    setPhase('redirecting')
    try {
      if (session) {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw new Error('기존 로그인을 종료하지 못했어요. 다시 시도해 주세요.')
      }
      await signInWithGoogle(window.location.pathname)
    } catch (error) {
      starting.current = false
      setMessage(error.message)
      setPhase('error')
    }
  }, [session])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) { setMessage('로그인 상태를 확인하지 못했어요.'); setPhase('error') }
      else setSession(data.session || null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { if (active) setSession(value) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      const timer = window.setTimeout(startLogin, 0)
      return () => window.clearTimeout(timer)
    }
    let active = true
    const verify = async () => {
      try {
        await checkAdmin()
        if (active) { setApprovedToken(session.access_token); setPhase('allowed'); setMessage('') }
      } catch (error) {
        if (active) { setPhase(error.status === 403 ? 'denied' : 'error'); setMessage(error.message) }
      }
    }
    void verify()
    const timer = window.setInterval(verify, 30000)
    window.addEventListener('focus', verify)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [session, startLogin])

  if (phase === 'allowed' && session && approvedToken === session.access_token) return children
  return <main className="auth-status">
    <a href="/" className="admin-brand">TalkConcert</a>
    <p role="status">{message || (phase === 'redirecting' ? 'Google 로그인으로 이동 중…' : '로그인 권한을 확인하고 있어요…')}</p>
    {['denied', 'error'].includes(phase) && <>
      <button className="text-button" onClick={startLogin}>{phase === 'denied' ? '다른 Google 계정으로 로그인' : '로그인 다시 시도'}</button>
      <a href="/" className="login-audience">질문 보드로 돌아가기</a>
    </>}
  </main>
}
