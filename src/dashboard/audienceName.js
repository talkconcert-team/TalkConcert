export const audienceAdjectives = ['찬란한', '빛나는', '용감한', '다정한', '유쾌한', '씩씩한', '따뜻한', '멋진', '설레는', '꿈꾸는', '반짝이는', '활기찬']

// 계정 대신 브라우저에 별명을 보관한다. 저장이 막혀도 질문 작성은 가능하다.
export function loadAudienceName(storage) {
  try {
    storage ||= localStorage
    const saved = storage.getItem('talkconcert-audience-name-v1')
    if (audienceAdjectives.some((word) => saved === `${word} 부소마인`)) return saved
  } catch { /* 저장소 없이도 임의 이름을 사용한다. */ }
  const name = `${audienceAdjectives[crypto.getRandomValues(new Uint32Array(1))[0] % audienceAdjectives.length]} 부소마인`
  try { storage.setItem('talkconcert-audience-name-v1', name) } catch { /* 현재 화면에서는 같은 이름을 유지한다. */ }
  return name
}
