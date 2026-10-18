import AdminSettings from './AdminSettings'
import useSettings from '../hooks/useSettings'
import { useState } from 'react'
import AdminContent from './AdminContent'
import AdminSignOut from '../../components/AdminSignOut'

export default function AdminPage() {
  const state = useSettings()
  const [tab, setTab] = useState('content')
  return <div className="app-shell admin-shell">
    <header className="admin-header"><a href="/admin" className="admin-brand">TalkConcert</a><span>관리자 CMS</span><AdminSignOut /></header>
    <nav className="cms-tabs" aria-label="관리자 메뉴">
      <button aria-pressed={tab === 'content'} onClick={() => setTab('content')}>주제·질문 관리</button>
      <button aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>기능 설정</button>
    </nav>
    <main className="admin-settings cms-main">
      {tab === 'content' ? <AdminContent canManageTopics={state.available && state.settings.topics} /> : <AdminSettings {...state} />}
    </main>
  </div>
}
