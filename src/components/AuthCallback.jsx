import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkAdmin, checkAudience, signInWithGoogle } from '../lib/adminAuth'
import { notifyError } from '../lib/toast'

export default function AuthCallback() {
  const [message, setMessage] = useState('Google 로그인을 확인하고 있어요…')
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const starting = useRef(false)

  useEffect(() => {
    let active = true
    const finish = async () => {
      try {
        if (!supabase) throw new Error('Supabase 연결 정보가 없어요.')
        const query = new URLSearchParams(window.location.search)
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        if (query.has('error') || fragment.has('error')) throw new Error('Google 로그인이 취소되었거나 실패했어요.')
        // PKCE 코드 교환은 클라이언트 초기화에 맡기며, 취소된 effect는 후속 인증을 실행하지 않는다.
        const { data, error } = await supabase.auth.getSession()
        if (!active) return
        if (error || !data.session) throw new Error('로그인 정보를 확인하지 못했어요. 로그인을 다시 시작해 주세요.')
        const next = window.sessionStorage.getItem('talkconcert-admin-next')
        await (['/admin', '/presenter'].includes(next) ? checkAdmin() : checkAudience())
        if (!active) return
        window.sessionStorage.removeItem('talkconcert-admin-next')
        window.location.replace(['/', '/admin', '/presenter'].includes(next) ? next : '/')
      } catch (error) {
        if (!active) return
        // 거절된 계정을 정리하되, 로그아웃 실패가 원래의 로그인 실패 안내를 가리지 않게 한다.
        if (error.status === 403) {
          try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* 재시도에서도 세션을 정리한다. */ }
        }
        if (!active) return
        window.history.replaceState(null, '', '/auth/callback')
        notifyError(error.message)
        setMessage(error.message)
        setFailed(true)
      }
    }
    void finish()
    return () => { active = false }
  }, [])

  async function retryLogin() {
    if (starting.current) return
    starting.current = true
    setRetrying(true)
    try {
      if (!supabase) throw new Error('Supabase 연결 정보가 없어요.')
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw new Error('기존 로그인을 정리하지 못했어요. 다시 시도해 주세요.')
      // 원래 진입 경로를 보존하고 Google 계정 선택 화면을 다시 연다.
      await signInWithGoogle(window.sessionStorage.getItem('talkconcert-admin-next') || '/')
    } catch (error) {
      setMessage(error.message)
      setRetrying(false)
      starting.current = false
    }
  }

  return <main className="auth-status auth-callback">
    <section className="auth-callback-card" aria-labelledby="auth-result-title">
      <a href="/" className="admin-brand">TalkConcert</a>
      <h1 id="auth-result-title">{failed ? '로그인하지 못했어요' : '로그인 확인 중'}</h1>
      <p role="status">{message}</p>
      {failed && <button className="primary-button" onClick={retryLogin} disabled={retrying}>{retrying ? 'Google 로그인으로 이동 중…' : '다시 로그인하기'}</button>}
      <a href="/" className="login-audience">질문 보드로 돌아가기</a>
    </section>
  </main>
}
