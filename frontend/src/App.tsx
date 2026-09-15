import { useState } from 'react'
import type { Project } from './api/types'
import AudioWorkspace from './pages/AudioWorkspace'
import ImageWorkspace from './pages/ImageWorkspace'
import Launcher from './pages/Launcher'
import TextWorkspace from './pages/TextWorkspace'

export default function App() {
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
