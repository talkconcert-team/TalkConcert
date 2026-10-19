import { supabase } from './supabase.js'
import { requestJson, withTimeout } from './requestTimeout.js'

export async function sessionHeaders() {
  if (!supabase) throw new Error('Supabase 로그인 연결 정보가 없어요.')
  const { data, error } = await withTimeout(() => supabase.auth.getSession())
  if (error || !data.session) throw new Error('Google 로그인이 필요해요.')
  // 이 세션은 전송 용도이며 최종 검증은 서버의 getUser와 DB에서 한다.
  return { Authorization: `Bearer ${data.session.access_token}` }
}

export const adminHeaders = sessionHeaders

export async function checkAudience() {
  const { response, data } = await requestJson('/api/auth/audience', { headers: await sessionHeaders(), cache: 'no-store' })
  if (!response.ok) {
    const error = new Error(data?.error || '로그인 상태를 확인하지 못했어요.')
    error.status = response.status
    throw error
  }
  return data
}

export async function checkAdmin() {
  const { response, data } = await requestJson('/api/auth/admin', { headers: await adminHeaders(), cache: 'no-store' })
  if (!response.ok) {
    const error = new Error(data?.error || '관리자 권한을 확인하지 못했어요.')
    error.status = response.status
    throw error
  }
  return data
}

export async function signInWithGoogle(next) {
  if (!supabase) throw new Error('Supabase 로그인 연결 정보가 없어요.')
  const destination = ['/', '/admin', '/presenter'].includes(next) ? next : '/'
  window.sessionStorage.setItem('talkconcert-admin-next', destination)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw new Error(/provider|enabled/i.test(error.message) ? 'Supabase의 Google 로그인 설정이 아직 완료되지 않았어요.' : 'Google 로그인을 시작하지 못했어요. 다시 시도해 주세요.')
}
