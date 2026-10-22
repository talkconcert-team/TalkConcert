const key = 'talkconcert-note-owners-v1'

export function loadNoteOwners(storage) {
  try {
    const saved = JSON.parse((storage || localStorage).getItem(key))
    return Object.fromEntries(Object.entries(saved || {}).filter(([id, token]) => /^[0-9a-f-]{36}$/i.test(id) && typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)))
  } catch { return {} }
}

export function rememberNoteOwner(id, storage = localStorage, previousToken) {
  const owners = loadNoteOwners(storage)
  const token = owners[id] || previousToken || Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const next = { ...owners, [id]: token }
  // 저장이 막히면 호출부에서 같은 토큰을 메모리에 유지해 재시도한다.
  storage.setItem(key, JSON.stringify(next))
  return { owners: next, token }
}
