// 화면 표시와 동작에 같은 조건을 적용한다. 인증과 서버 권한 검증은 별도로 필요하다.
export function boardPermissions(isPresenter, settings) {
  return {
    canDraw: isPresenter && settings.draw,
    canManageTopics: isPresenter && settings.topics,
  }
}
