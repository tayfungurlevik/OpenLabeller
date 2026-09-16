import type {
  AudioItem,
  ImageAnnotation,
  ImageFileEntry,
  Project,
  ShapeData,
  TaskType,
  TextItem,
} from './types'

let backendUrl = 'http://127.0.0.1:8756'

export async function initBackendUrl(): Promise<void> {
  if (window.api?.getBackendUrl) {
    backendUrl = await window.api.getBackendUrl()
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export function fileUrl(path: string, params: Record<string, string>): string {
  return `${backendUrl}${path}?${new URLSearchParams(params)}`
}

export const api = {
  createProject: (task_type: TaskType, data_dir: string, name?: string) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ task_type, data_dir, name }),
    }),
  getProject: (dir: string) => request<Project>(`/api/projects?${new URLSearchParams({ dir })}`),
  updateProject: (dir: string, patch: { name?: string; multi_label?: boolean }) =>
    request<Project>('/api/projects', {
      method: 'PATCH',
      body: JSON.stringify({ dir, ...patch }),
    }),
  addLabel: (dir: string, name: string) =>
    request<Project>('/api/projects/labels', {
      method: 'POST',
      body: JSON.stringify({ dir, name }),
    }),
  removeLabel: (dir: string, name: string) =>
    request<Project>(`/api/projects/labels?${new URLSearchParams({ dir, name })}`, {
      method: 'DELETE',
    }),

  listImages: (dir: string) => request<ImageFileEntry[]>(`/api/image/files?${new URLSearchParams({ dir })}`),
  imageFileUrl: (dir: string, name: string) => fileUrl('/api/image/file', { dir, name }),
  getImageAnnotation: (dir: string, name: string) =>
    request<ImageAnnotation>(`/api/image/annotation?${new URLSearchParams({ dir, name })}`),
  saveImageAnnotation: (dir: string, name: string, shapes: ShapeData[]) =>
    request<{ status: string }>(`/api/image/annotation?${new URLSearchParams({ dir, name })}`, {
      method: 'PUT',
      body: JSON.stringify({ shapes }),
    }),
  exportImage: (format: 'coco' | 'yolo' | 'voc', dir: string, path: string) =>
    request<{ status: string }>(`/api/image/export/${format}`, {
      method: 'POST',
      body: JSON.stringify({ dir, path }),
    }),

  listTextItems: (dir: string) => request<TextItem[]>(`/api/text/items?${new URLSearchParams({ dir })}`),
  saveTextLabels: (dir: string, id: string, labels: string[]) =>
    request<{ status: string }>(`/api/text/item?${new URLSearchParams({ dir, id })}`, {
      method: 'PUT',
      body: JSON.stringify({ labels }),
    }),
  exportText: (dir: string, format: 'csv' | 'jsonl', path: string) =>
    request<{ status: string }>(`/api/text/export?${new URLSearchParams({ dir, format, path })}`, {
      method: 'POST',
    }),

  listAudioItems: (dir: string) => request<AudioItem[]>(`/api/audio/files?${new URLSearchParams({ dir })}`),
  audioFileUrl: (dir: string, name: string) => fileUrl('/api/audio/file', { dir, name }),
  getAudioPeaks: (dir: string, name: string) =>
    request<{ peaks: [number, number][] | null }>(`/api/audio/peaks?${new URLSearchParams({ dir, name })}`),
  saveAudioLabels: (dir: string, id: string, labels: string[]) =>
    request<{ status: string }>(`/api/audio/item?${new URLSearchParams({ dir, id })}`, {
      method: 'PUT',
      body: JSON.stringify({ labels }),
    }),
  convertAudioToWav: (dir: string, name?: string) =>
    request<{ converted: string[]; skipped: string[]; errors: { file: string; error: string }[] }>(
      '/api/audio/convert',
      {
        method: 'POST',
        body: JSON.stringify({ dir, name }),
      },
    ),
  exportAudio: (dir: string, format: 'csv' | 'jsonl', path: string) =>
    request<{ status: string }>(`/api/audio/export?${new URLSearchParams({ dir, format, path })}`, {
      method: 'POST',
    }),
}
