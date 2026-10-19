import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { checkAdmin, checkAudience } from '../lib/adminAuth'
import { notifyError } from '../lib/toast'

export default function AuthCallback() {
  const [message, setMessage] = useState('Google 로그인을 확인하고 있어요…')
  useEffect(() => {
    let active = true
    const finish = async () => {
      try {
        if (!supabase) throw new Error('Supabase 연결 정보가 없어요.')
        const query = new URLSearchParams(window.location.search)
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        if (query.has('error') || fragment.has('error')) throw new Error('Google 로그인이 취소되었거나 실패했어요.')
        // PKCE 코드 교환은 Supabase 클라이언트 초기화가 수행한다. 중복 교환하지 않는다.
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) throw new Error('로그인 정보를 확인하지 못했어요. 로그인을 다시 시작해 주세요.')
        const next = window.sessionStorage.getItem('talkconcert-admin-next')
        await (['/admin', '/presenter'].includes(next) ? checkAdmin() : checkAudience())
        window.sessionStorage.removeItem('talkconcert-admin-next')
        if (active) window.location.replace(['/', '/admin', '/presenter'].includes(next) ? next : '/')
      } catch (error) {
        if (error.status === 403) await supabase.auth.signOut({ scope: 'local' })
        notifyError(error.message)
        if (active) { window.history.replaceState(null, '', '/auth/callback'); setMessage(error.message) }
      }
    }
    void finish()
    return () => { active = false }
  }, [])
  return <main className="auth-status"><a href="/" className="admin-brand">TalkConcert</a><p role="status">{message}</p><a href="/" className="login-audience">질문 보드로 돌아가기</a></main>
}
