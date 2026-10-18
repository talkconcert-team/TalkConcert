import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminSignOut({ returnTo = '/admin' }) {
  const [error, setError] = useState('')
  return <span className="admin-signout"><button className="outline-button" onClick={async () => {
    const { error: problem } = await supabase.auth.signOut({ scope: 'local' })
    if (problem) setError('로그아웃에 실패했어요. 다시 시도해 주세요.')
    else window.location.replace(returnTo)
  }}>로그아웃</button>{error && <span role="status">{error}</span>}</span>
}
