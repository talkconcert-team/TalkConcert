import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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
    <ToastContainer position="top-center" autoClose={4500} newestOnTop closeOnClick pauseOnFocusLoss />
    {/* 관객 보드만 집계하고 URL의 검색어·인증 정보는 통계에 보내지 않는다. */}
    {import.meta.env.PROD && page === '/' && <Analytics beforeSend={(event) => {
      const url = new URL(event.url)
      url.search = ''
      url.hash = ''
      return { ...event, url: url.toString() }
    }} />}
  </StrictMode>,
)
