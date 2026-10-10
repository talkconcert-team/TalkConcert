import { useState } from 'react'
import QuestionEditor from './QuestionEditor'
import Icon from '../../components/Icon'
import { noteStyle, noteColors, stickers } from '../dashboardData'

// 질문 내용·주제·색·스티커를 입력받고 등록 전 메모 모습을 보여준다.
export default function QuestionComposer({
  columns,
  composeColumn,
  setComposeColumn,
  draft,
  setDraft,
  color,
  setColor,
  sticker,
  setSticker,
  input,
  submit,
  notice,
}) {
  const [valid, setValid] = useState(false)

  return (
    <section className="panel compose-panel" aria-labelledby="compose-heading">
      <div className="panel-header">
        <h2 id="compose-heading">질문 작성</h2>
        <Icon name="edit" size={17} />
      </div>
      <div className="compose-content">
        <div className="context-field">
          <Icon name="message" size={16} />
          <span>오늘의 토크 콘서트</span>
          <span className="muted">Q&A</span>
        </div>
        <div className="welcome-copy">
          <p>작은 메모 한 장으로 시작해요.</p>
          <p className="muted">
            색을 고르고, 궁금한 점을 남겨보세요.
            <br />
            다른 사람들의 질문도 함께 볼 수 있어요.
          </p>
        </div>
      </div>
      <div className="composer-bottom">
        <form className="note-form" onSubmit={event => { if (valid) submit(event); else event.preventDefault() }}>
          <label className="column-select-label" htmlFor="compose-column">
            질문을 붙일 곳
          </label>
          <select
            id="compose-column"
            className="column-select"
            value={composeColumn}
            onChange={(event) => setComposeColumn(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
          <div className="draft-note" style={noteStyle(color)}>
            <div className="note-author">
              <span className="note-sticker" aria-hidden="true">
                {sticker}
              </span>
              <span>
                익명의 관객<small>내 메모 미리보기</small>
              </span>
            </div>
            <QuestionEditor draft={draft} setDraft={setDraft} input={input} onValidityChange={setValid} />
          </div>
          <fieldset className="note-options">
            <legend>메모지 색</legend>
            <div className="color-options">
              {noteColors.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="color-swatch"
                  style={{ background: option.value }}
                  aria-label={option.label}
                  aria-pressed={color === option.id}
                  title={option.label}
                  onClick={() => setColor(option.id)}
                >
                  {color === option.id && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="note-options">
            <legend>작은 포인트</legend>
            <div className="sticker-options">
              {stickers.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option + ' 스티커'}
                  aria-pressed={sticker === option}
                  onClick={() => setSticker(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="primary-button post-note"
            disabled={!valid || !draft.trim()}
          >
            <Icon name="plus" size={17} /> 보드에 붙이기
          </button>
          <p className="notice" role="status">
            {notice || '로그인 없이, 익명으로 남길 수 있어요.'}
          </p>
        </form>
      </div>
    </section>
  )
}
