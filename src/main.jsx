import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminPage from './dashboard/components/AdminPage.jsx'
import GoogleGate from './components/GoogleGate.jsx'
import AuthCallback from './components/AuthCallback.jsx'

// 관리 화면은 UI 진입과 API 모두 Google 계정·DB 허용 목록을 검증한다.
const page = window.location.pathname.replace(/\/+$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {page === '/auth/callback' ? <AuthCallback /> : ['/admin', '/presenter'].includes(page) ? <GoogleGate>{page === '/admin' ? <AdminPage /> : <App isPresenter />}</GoogleGate> : <App />}
  </StrictMode>,
)
