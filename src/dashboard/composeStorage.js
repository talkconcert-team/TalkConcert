const draftKey = 'talkconcert-compose-intent'
const pendingKey = 'talkconcert-pending-question'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function read(key, storage) {
  try { return JSON.parse((storage || sessionStorage).getItem(key) || 'null') } catch { return null }
}

function write(key, value, storage) {
  try {
    const target = storage || sessionStorage
    if (value === null) target.removeItem(key)
    else target.setItem(key, JSON.stringify(value))
  } catch { /* 저장이 차단되어도 질문 참여를 막지 않는다. */ }
}

// 미등록 초안은 같은 탭에서만 보관하고 서버로 전송하지 않는다.
export function loadComposeIntent(storage) {
  const value = read(draftKey, storage)
  return {
    draft: typeof value?.draft === 'string' ? value.draft : '',
    columnId: typeof value?.columnId === 'string' ? value.columnId : '',
    color: /^(cream|rose|mint|sky|lavender|white|#[0-9a-f]{6})$/i.test(value?.color) ? value.color : 'cream',
  }
}

export const saveComposeIntent = (value, storage) => write(draftKey, value, storage)

export function loadPendingQuestion(storage) {
  const value = read(pendingKey, storage)
  if (!value || !uuid.test(value.id) || typeof value.fingerprint !== 'string') return null
  return { id: value.id, fingerprint: value.fingerprint, ...(/^[0-9a-f]{64}$/.test(value.token) ? { token: value.token } : {}) }
}

// 새로고침 후에도 같은 요청 ID를 재사용해 통신 오류에 따른 중복 등록을 막는다.
export const savePendingQuestion = (value, storage) => write(pendingKey, value, storage)
