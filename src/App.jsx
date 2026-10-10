import { useRef, useState } from 'react'
import './App.css'
import { noteStyle } from './dashboard/dashboardData'
import useDashboard from './dashboard/hooks/useDashboard'
import useNoteDrag from './dashboard/hooks/useNoteDrag'
import DashboardSidebar from './dashboard/components/DashboardSidebar'
import DashboardHeader from './dashboard/components/DashboardHeader'
import QuestionComposer from './dashboard/components/QuestionComposer'
import QuestionBoard from './dashboard/components/QuestionBoard'
import QuestionDetail from './dashboard/components/QuestionDetail'
import QuestionPresentation from './dashboard/components/QuestionPresentation'

// 대시보드 상태를 각 패널에 연결하고, 크게 보기와 드래그 미리보기를 배치한다.
export default function App() {
  const state = useDashboard()
  const dragControls = useNoteDrag(state)
  const [presenting, setPresenting] = useState(false)
  const previewButton = useRef(null)
  const { drag } = dragControls
  return (
    <div className="app-shell">
      <DashboardSidebar
        drawing={state.drawing}
        draw={state.draw}
        waiting={state.waiting}
      />
      <div className="app-main">
        <DashboardHeader
          questions={state.questions}
          selected={state.selected}
          drawing={state.drawing}
          previewButton={previewButton}
          setPresenting={setPresenting}
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
            filter={state.filter}
            setFilter={state.setFilter}
            board={state.board}
            columns={state.columns}
            columnFor={state.columnFor}
            visibleQuestions={state.visibleQuestions}
            editingColumn={state.editingColumn}
            renameColumn={state.renameColumn}
            setEditingColumn={state.setEditingColumn}
            composeIn={state.composeIn}
            selectedId={state.selectedId}
            setSelectedId={state.setSelectedId}
            drawing={state.drawing}
            dragControls={dragControls}
          />
          <QuestionDetail
            selected={state.selected}
            drawing={state.drawing}
            complete={state.complete}
            waiting={state.waiting}
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
          <span>{drag.item.sticker} 질문 이동 중</span>
          <p>{drag.item.text}</p>
        </div>
      )}
      {presenting && state.selected && (
        <QuestionPresentation
          selected={state.selected}
          setPresenting={setPresenting}
          previewButton={previewButton}
        />
      )}
    </div>
  )
}
