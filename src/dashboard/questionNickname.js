// Google 계정 이메일의 @ 앞부분을 학번으로 사용하고, 이름은 프로필에서 가져온다.
export function questionNickname(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  const studentId = email.split('@')[0]
  const metadata = user?.user_metadata || {}
  const name = String(metadata.full_name || metadata.name || '').trim()
  if (!studentId || !name || !email.includes('@')) return '익명의 관객'
  return `${studentId}-${name}`
}

