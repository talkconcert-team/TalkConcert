import {
  GripVertical,
  MessageSquare,
  Shuffle,
  Plus,
  ArrowUp,
  Check,
  Pencil,
  Maximize,
  X,
} from 'lucide-react'

const icons = {
  grip: GripVertical,
  message: MessageSquare,
  shuffle: Shuffle,
  plus: Plus,
  arrow: ArrowUp,
  check: Check,
  edit: Pencil,
  expand: Maximize,
  close: X,
}

// 공통 아이콘의 크기와 선 굵기를 통일한다. 접근성 이름은 사용하는 버튼에서 제공한다.
export default function Icon({ name, size = 18 }) {
  const Component = icons[name]
  return <Component size={size} strokeWidth={1.6} aria-hidden="true" />
}
