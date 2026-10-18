export default function AdminSettings({ settings, updateSetting, notice, disabled, available }) {
  return (
    <section>
        <p className="admin-eyebrow">행사 운영</p>
        <h1>화면별 기능 설정</h1>
        <p className="admin-description">진행 화면의 추첨과 CMS의 주제 관리 기능을 설정하세요.</p>
        <section className="settings-panel" aria-label="진행 화면 권한">
          {[
            ['draw', '랜덤 추첨', '진행 화면 왼쪽의 랜덤 질문 뽑기 버튼'],
            ['topics', '주제 관리', '주제 추가와 주제 이름 수정'],
          ].map(([key, title, description]) => (
            <fieldset className="permission-row" key={key} disabled={disabled}>
              <legend>{title}</legend>
              <p>{description}</p>
              <div className="permission-options">
                {[true, false].map((enabled) => (
                  <label key={String(enabled)}>
                    <input type="radio" name={key} checked={available && settings[key] === enabled}
                      onChange={() => updateSetting(key, enabled)} />
                    {enabled ? '이용 가능' : '제한'}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
        <p className="settings-status" role="status">{notice}</p>
        <section className="screen-links" aria-label="행사 화면 열기">
          <a href="/presenter" target="_blank" rel="noopener noreferrer"><strong>진행 화면 열기 ↗</strong><span>행사 중 보드와 랜덤 추첨을 띄우는 화면</span></a>
          <a href="/" target="_blank" rel="noopener noreferrer"><strong>관객 화면 열기 ↗</strong><span>관객이 질문을 작성하고 보드를 보는 화면</span></a>
        </section>
        <p className="admin-footnote">설정·주제·질문은 모두 Supabase에 저장됩니다. 진행 화면은 보드 표시와 추첨 용도입니다.</p>
    </section>
  )
}
