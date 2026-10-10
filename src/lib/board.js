export function moveNote(items, sourceId, targetId, after = false, columnId) {
  const source = items.find(item => item.id === sourceId)
  if (!source || sourceId === targetId) return items
  const target = items.find(item => item.id === targetId)
  if (!target && !columnId) return items
  const remaining = items.filter(item => item.id !== sourceId)
  const position = target ? remaining.findIndex(item => item.id === targetId) + Number(after) : remaining.length
  const moved = { ...source, columnId: columnId || target?.columnId || source.columnId }
  return [...remaining.slice(0, position), moved, ...remaining.slice(position)]
}
