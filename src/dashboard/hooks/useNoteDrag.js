import { useEffect, useRef, useState } from 'react'
import { moveNote } from '../../lib/board'

// 포인터와 방향키 이동을 같은 메모 재배치 함수로 처리한다.
export default function useNoteDrag({
  drawing,
  board,
  columns,
  columnFor,
  visibleQuestions,
  setQuestions,
  setNotice,
}) {
  const [drag, setDrag] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  // 이벤트 사이의 최신 이동 대상은 ref로, 화면의 강조·미리보기는 state로 관리한다.
  const dropRef = useRef(null)
  const dragRef = useRef(null)
  function cancelDrag() {
    dragRef.current = null
    dropRef.current = null
    setDrag(null)
    setDropTarget(null)
  }

  useEffect(() => {
    const cancel = (event) => {
      if (event.key === 'Escape') cancelDrag()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])

  function startDrag(event, item) {
    if (event.button !== 0 || drawing) return
    event.preventDefault()
    // 손잡이 밖으로 포인터가 나가도 이동과 놓기 이벤트를 계속 받는다.
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = item.id
    setDrag({ item, x: event.clientX, y: event.clientY })
    setNotice('원하는 메모 앞이나 뒤에 놓아주세요. Esc로 취소할 수 있어요.')
  }

  function dragMove(event) {
    if (!dragRef.current) return
    setDrag(
      (current) =>
        current && { ...current, x: event.clientX, y: event.clientY },
    )
    const container = board.current
    if (container) {
      const bounds = container.getBoundingClientRect()
      if (event.clientY > bounds.bottom - 50) container.scrollBy({ top: 16 })
      if (event.clientY < bounds.top + 50) container.scrollBy({ top: -16 })
      if (event.clientX > bounds.right - 60) container.scrollBy({ left: 18 })
      if (event.clientX < bounds.left + 60) container.scrollBy({ left: -18 })
    }
    // 포인터 캡처 중 event.target은 손잡이이므로 실제 포인터 아래 요소를 찾는다.
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const target = element?.closest('[data-note-id]')
    const column = element?.closest('[data-column-id]')
    if (!column || target?.dataset.noteId === dragRef.current) {
      dropRef.current = null
      setDropTarget(null)
      return
    }
    const bounds = target?.getBoundingClientRect()
    // 카드 중간을 기준으로 앞/뒤에 삽입한다. 빈 열에서는 해당 열 끝에 추가한다.
    const after = bounds ? event.clientY > bounds.top + bounds.height / 2 : true
    const destination = {
      id: target?.dataset.noteId,
      columnId: column.dataset.columnId,
      after,
    }
    dropRef.current = destination
    setDropTarget(destination)
  }

  function finishDrag() {
    const target = dropRef.current
    if (dragRef.current && target) {
      const source = dragRef.current
      setQuestions((current) =>
        moveNote(current, source, target.id, target.after, target.columnId),
      )
      setNotice('메모 순서를 변경했어요.')
    }
    cancelDrag()
  }

  function moveWithKeyboard(event, item) {
    const direction = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    }[event.key]
    if (!direction) return
    event.preventDefault()
    // 좌우는 인접 주제로, 위아래는 현재 필터에 보이는 같은 주제의 메모 사이로 이동한다.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const nextColumn =
        columns[
          columns.findIndex((column) => column.id === columnFor(item)) +
            direction
        ]
      if (nextColumn)
        setQuestions((current) =>
          moveNote(current, item.id, null, true, nextColumn.id),
        )
      return
    }
    const siblings = visibleQuestions.filter(
      (note) => columnFor(note) === columnFor(item),
    )
    const destination =
      siblings[siblings.findIndex((note) => note.id === item.id) + direction]
    if (!destination) return
    setQuestions((current) =>
      moveNote(
        current,
        item.id,
        destination.id,
        direction > 0,
        columnFor(item),
      ),
    )
    setNotice('메모 순서를 변경했어요.')
  }

  return {
    drag,
    dropTarget,
    startDrag,
    dragMove,
    finishDrag,
    cancelDrag,
    moveWithKeyboard,
  }
}
