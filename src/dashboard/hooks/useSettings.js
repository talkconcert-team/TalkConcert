import { useEffect, useRef, useState } from 'react'
import { requestSettings } from '../settingsStore'

export default function useSettings() {
  const [settings, setSettings] = useState({ draw: false, topics: false })
  const [loaded, setLoaded] = useState(false)
  const [readError, setReadError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const writing = useRef(false)
  const version = useRef(0)
  const retryAfter = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    let active = true
    mounted.current = true
    const refresh = async () => {
      if (writing.current || Date.now() < retryAfter.current) return
      const started = version.current
      try {
        const data = await requestSettings()
        // 저장 전에 시작한 조회 결과가 최신 저장값을 되돌리지 않게 한다.
        if (!active || started !== version.current) return
        setSettings(data)
        setLoaded(true)
        setReadError('')
        retryAfter.current = 0
      } catch (error) {
        if (active && started === version.current) {
          retryAfter.current = Date.now() + 30000
          setReadError(error.message)
        }
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    window.addEventListener('talkconcert-settings-saved', refresh)
    return () => {
      active = false
      mounted.current = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('talkconcert-settings-saved', refresh)
    }
  }, [])

  async function updateSetting(key, enabled) {
    if (writing.current || !loaded || readError || !['draw', 'topics'].includes(key) || typeof enabled !== 'boolean') return
    writing.current = true
    version.current += 1
    setSaving(true)
    setNotice('Supabase에 저장 중이에요…')
    try {
      const saved = await requestSettings({ [key]: enabled })
      if (!mounted.current) return
      setSettings(saved)
      setNotice('Supabase에 저장했어요.')
      window.dispatchEvent(new Event('talkconcert-settings-saved'))
    } catch (error) {
      // 실패하면 기존 선택을 유지해 저장되지 않은 설정이 적용된 것처럼 보이지 않게 한다.
      if (mounted.current) setNotice(error.message)
    } finally {
      writing.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return {
    settings,
    updateSetting,
    available: loaded && !readError,
    disabled: !loaded || Boolean(readError) || saving,
    notice: readError || notice || (loaded ? 'Supabase에 저장된 설정입니다.' : 'Supabase에서 설정을 불러오는 중이에요…'),
    error: readError,
  }
}
