import './App.css'
import useDashboard from './dashboard/hooks/useDashboard'
import DashboardSidebar from './dashboard/components/DashboardSidebar'
import DashboardHeader from './dashboard/components/DashboardHeader'
import QuestionComposer from './dashboard/components/QuestionComposer'
import QuestionBoard from './dashboard/components/QuestionBoard'
import QuestionPresentation from './dashboard/components/QuestionPresentation'
import { boardPermissions } from './dashboard/permissions'
import useSettings from './dashboard/hooks/useSettings'
import useNoteDrag from './dashboard/hooks/useNoteDrag'
import QuestionMarkdown from './dashboard/components/QuestionMarkdown'
import { noteStyle } from './dashboard/dashboardData'

// 대시보드 상태를 각 패널에 연결하고, 크게 보기와 드래그 미리보기를 배치한다.
export default function App({ isPresenter = false }) {
  const savedSettings = useSettings()
  const permissions = boardPermissions(isPresenter && savedSettings.available, savedSettings.settings)
  const state = useDashboard({ ...permissions, isPresenter })
  const dragControls = useNoteDrag(state)
  return (
    <div className="app-shell">
      {permissions.canDraw && <DashboardSidebar
        drawing={state.drawing}
        draw={state.draw}
        available={state.drawAvailable}
        hint={state.drawHint}
      />}
      <div className="app-main">
        <DashboardHeader
          questions={state.questions}
          selected={state.selected}
          drawing={state.drawing}
          setPresenting={state.setPresenting}
          isPresenter={isPresenter}
          signedIn={state.signedIn}
          accountEmail={state.accountEmail}
          authorName={state.authorName}
        />
        {isPresenter && savedSettings.error && <p className="settings-warning" role="status">{savedSettings.error}</p>}
        {state.error && <p className="settings-warning" role="status">{state.error}</p>}
        {isPresenter && !state.error && (state.notice || permissions.canDraw) && <p id="draw-status" className="settings-status" role="status">{permissions.canDraw && state.drawExhausted ? state.drawHint : state.notice || state.drawHint}</p>}
        <main className={isPresenter ? 'workspace presenter-workspace' : 'workspace'}>
          {!isPresenter && <QuestionComposer
            columns={state.columns}
            composeColumn={state.composeColumn}
            setComposeColumn={state.setComposeColumn}
            draft={state.draft}
            setDraft={state.setDraft}
            color={state.color}
            setColor={state.setColor}
            input={state.input}
            submit={state.submit}
            notice={state.notice}
            busy={state.busy || !state.loaded || !state.columns.length}
            posting={state.posting}
            authorName={state.authorName}
          />}
          <QuestionBoard
            questions={state.questions}
            board={state.board}
            columns={state.columns}
            columnFor={state.columnFor}
            composeIn={state.composeIn}
            selectedId={state.selectedId}
            openQuestion={state.openQuestion}
            drawing={state.drawing}
            canCompose={!isPresenter}
            loaded={state.loaded}
            dragControls={dragControls}
            busy={state.busy}
            canManageMoves={state.canManageMoves}
          />
        </main>
      </div>
      {dragControls.drag && <div className="drag-preview" style={{ ...noteStyle(dragControls.drag.item.color), left: dragControls.drag.x + 14, top: dragControls.drag.y + 14 }} aria-hidden="true">
        <span>질문 #{dragControls.drag.item.number}</span><p><QuestionMarkdown>{dragControls.drag.item.text}</QuestionMarkdown></p>
      </div>}
      {state.presenting && (
        <QuestionPresentation
          selected={state.selected}
          columns={state.columns}
          slot={state.slot}
          finishDraw={state.finishDraw}
          closePresentation={state.closePresentation}
        />
      )}
    </div>
  )
}
