import { useState, useEffect } from 'react';
import { Store } from './store';
import type { ProjectData } from './store';

interface DashboardProps {
    onOpenProject: (project: ProjectData) => void;
}

export default function Dashboard({ onOpenProject }: DashboardProps) {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = () => {
        setProjects(Store.getProjects());
    };

    const handleCreateProject = () => {
        if (!newProjectName.trim()) return;
        const project = Store.createEmptyProject(newProjectName);
        Store.saveProject(project);
        setShowCreateModal(false);
        setNewProjectName('');
        onOpenProject(project); // Open immediately
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this mind map?')) {
            Store.deleteProject(id);
            loadProjects();
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const project: ProjectData = JSON.parse(json);
                if (project.id && project.rootNode) {
                    // Check for id collision and generate anew if necessary, but for simplicity just save it
                    Store.saveProject(project);
                    loadProjects();
                } else {
                    alert("Invalid Mind Map file format.");
                }
            } catch (err) {
                alert("Failed to parse JSON.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Mindscape</h1>
                <p>A simple, powerful mind mapping tool.</p>
                <div style={{ marginTop: '1rem' }}>
                    <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        Import Mind Map
                        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                    </label>
                </div>
            </div>

            <div className="projects-grid">
                <button
                    className="project-card create-card"
                    onClick={() => setShowCreateModal(true)}
                >
                    <span style={{ fontSize: '2rem' }}>+</span>
                    <span>Create New Mind Map</span>
                </button>

                {projects.map(project => (
                    <div
                        key={project.id}
                        className="project-card"
                        onClick={() => onOpenProject(project)}
                    >
                        <div className="project-card-header">
                            <span className="project-card-title">{project.name}</span>
                            <button
                                className="btn-danger"
                                onClick={(e) => handleDelete(e, project.id)}
                                title="Delete Project"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="project-card-meta">
                            Last updated: {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>New Mind Map</h2>
                        <input
                            autoFocus
                            className="input-text"
                            placeholder="e.g. Website Launch Strategy"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateProject();
                                if (e.key === 'Escape') setShowCreateModal(false);
                            }}
                        />
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleCreateProject}>Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
