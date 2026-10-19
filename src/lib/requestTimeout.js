// 조회·저장 모두 종료 시간을 둬 느린 연결이 화면을 계속 잠그지 않게 한다.
export async function withTimeout(operation, milliseconds = 15000, onTimeout) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.()
          const error = new Error('응답이 늦어졌어요. 저장 여부를 목록에서 확인한 뒤 다시 시도해 주세요.')
          error.code = 'REQUEST_TIMEOUT'
          reject(error)
        }, milliseconds)
      }),
    ])
  } finally { clearTimeout(timer) }
}

export function requestJson(url, options = {}, fetcher = fetch, milliseconds = 15000) {
  const controller = new AbortController()
  return withTimeout(async () => {
    const response = await fetcher(url, { ...options, signal: controller.signal })
    const data = await response.json().catch(() => null)
    return { response, data }
  }, milliseconds, () => controller.abort())
}
