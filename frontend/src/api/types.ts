export type TaskType = 'image' | 'text' | 'audio'

export interface LabelClass {
  name: string
  color: string
  shortcut: string | null
}

export interface Project {
  name: string
  task_type: TaskType
  data_dir: string
  output_dir: string
  multi_label: boolean
  labels: LabelClass[]
}

export interface ImageFileEntry {
  name: string
  labeled: boolean
}

export type ShapeType = 'rectangle' | 'polygon' | 'circle' | 'line' | 'point'

export interface ShapeData {
  label: string
  points: [number, number][]
  group_id: number | null
  shape_type: ShapeType
  flags: Record<string, unknown>
}

export interface ImageAnnotation {
  shapes: ShapeData[]
  width: number
  height: number
}

export interface TextItem {
  id: string
  text: string
  labels: string[]
}

export interface AudioItem {
  id: string
  labels: string[]
}

export interface WorkspaceProps {
  project: Project
  onBack: () => void
}
