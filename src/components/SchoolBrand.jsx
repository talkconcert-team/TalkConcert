// 행사 주최 학교를 보여주되 질문 보드의 공간을 많이 차지하지 않게 한다.
export default function SchoolBrand() {
  return <span className="school-brand">
    <img src="/bssm-emblem.png" width="36" height="36" alt="" aria-hidden="true" />
    <span className="school-brand-copy">
      <strong>부산소프트웨어마이스터고</strong>
      <span>TalkConcert 2026</span>
    </span>
  </span>
}
