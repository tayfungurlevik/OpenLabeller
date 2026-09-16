import { useState } from 'react'
import type { Project } from './api/types'
import { SettingsProvider } from './context/SettingsContext'
import AudioWorkspace from './pages/AudioWorkspace'
import ImageWorkspace from './pages/ImageWorkspace'
import Launcher from './pages/Launcher'
import TextWorkspace from './pages/TextWorkspace'

function AppRoutes() {
  const [project, setProject] = useState<Project | null>(null)

  if (!project) {
    return <Launcher onProjectReady={setProject} />
  }

  const goToLauncher = () => setProject(null)

  switch (project.task_type) {
    case 'image':
      return <ImageWorkspace project={project} onBack={goToLauncher} />
    case 'text':
      return <TextWorkspace project={project} onBack={goToLauncher} />
    case 'audio':
      return <AudioWorkspace project={project} onBack={goToLauncher} />
  }
}

export default function App() {
  return (
    <SettingsProvider>
      <AppRoutes />
    </SettingsProvider>
  )
}
