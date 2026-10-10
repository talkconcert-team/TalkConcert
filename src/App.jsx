import QuestionMarkdown from './dashboard/components/QuestionMarkdown'
import './App.css'
import { noteStyle } from './dashboard/dashboardData'
import useDashboard from './dashboard/hooks/useDashboard'
import useNoteDrag from './dashboard/hooks/useNoteDrag'
import DashboardSidebar from './dashboard/components/DashboardSidebar'
import DashboardHeader from './dashboard/components/DashboardHeader'
import QuestionComposer from './dashboard/components/QuestionComposer'
import QuestionBoard from './dashboard/components/QuestionBoard'
import QuestionPresentation from './dashboard/components/QuestionPresentation'

// 대시보드 상태를 각 패널에 연결하고, 크게 보기와 드래그 미리보기를 배치한다.
export default function App() {
  const state = useDashboard()
  const dragControls = useNoteDrag(state)
  const { drag } = dragControls
  return (
    <div className="app-shell">
      <DashboardSidebar
        drawing={state.drawing}
        draw={state.draw}
        questions={state.questions}
      />
      <div className="app-main">
        <DashboardHeader
          questions={state.questions}
          selected={state.selected}
          drawing={state.drawing}
          setPresenting={state.setPresenting}
        />
        <main className="workspace">
          <QuestionComposer
            columns={state.columns}
            composeColumn={state.composeColumn}
            setComposeColumn={state.setComposeColumn}
            draft={state.draft}
            setDraft={state.setDraft}
            color={state.color}
            setColor={state.setColor}
            sticker={state.sticker}
            setSticker={state.setSticker}
            input={state.input}
            submit={state.submit}
            notice={state.notice}
          />
          <QuestionBoard
            questions={state.questions}
            addColumn={state.addColumn}
            board={state.board}
            columns={state.columns}
            columnFor={state.columnFor}
            editingColumn={state.editingColumn}
            renameColumn={state.renameColumn}
            setEditingColumn={state.setEditingColumn}
            composeIn={state.composeIn}
            selectedId={state.selectedId}
            openQuestion={state.openQuestion}
            drawing={state.drawing}
            dragControls={dragControls}
          />
        </main>
      </div>
      {drag && (
        <div
          className="drag-preview"
          style={{
            ...noteStyle(drag.item.color),
            left: drag.x + 14,
            top: drag.y + 14,
          }}
          aria-hidden="true"
        >
          <span>{drag.item.sticker} 내 질문</span>
          <p><QuestionMarkdown>{drag.item.text}</QuestionMarkdown></p>
        </div>
      )}
      {state.presenting && (
        <QuestionPresentation
          selected={state.selected}
          slot={state.slot}
          finishDraw={state.finishDraw}
          closePresentation={state.closePresentation}
        />
      )}
    </div>
  )
}
