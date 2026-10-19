import { toast } from 'react-toastify'

// 자동 갱신이 같은 오류를 반복해서 받아도 한 세션에서는 한 번만 알린다.
const shownErrors = new Set()

export function notifyError(message) {
  const text = message instanceof Error ? message.message : String(message || '')
  if (!text || shownErrors.has(text)) return
  shownErrors.add(text)
  toast.error(text, { toastId: `error:${text}` })
}

export function notifySuccess(message) {
  const text = String(message || '')
  if (text) toast.success(text, { toastId: `success:${text}` })
}
