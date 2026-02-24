import { useState, useEffect } from 'react';
import './App.css';
import { Store } from './store';
import type { ProjectData } from './store';
import Dashboard from './Dashboard';
import Canvas from './Canvas';

function App() {
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  // Load from local storage on mount (optional refresh logic)
  useEffect(() => {
    if (currentProject) {
      // Keep it synced if needed, but Store handles most saves directly
    }
  }, [currentProject]);

  const handleOpenProject = (project: ProjectData) => {
    setCurrentProject(project);
  };

  const handleBackToDashboard = () => {
    setCurrentProject(null);
  };

  return (
    <div className="app-root">
      {currentProject ? (
        <Canvas
          project={currentProject}
          onBack={handleBackToDashboard}
          onUpdate={(updated) => {
            Store.saveProject(updated);
            setCurrentProject({ ...updated }); // Trigger re-render
          }}
        />
      ) : (
        <Dashboard onOpenProject={handleOpenProject} />
      )}
    </div>
  );
}

export default App;
