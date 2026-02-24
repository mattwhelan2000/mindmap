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
                const text = event.target?.result as string;

                if (file.name.endsWith('.json')) {
                    const project: ProjectData = JSON.parse(text);
                    if (project.id && project.rootNode) {
                        project.id = crypto.randomUUID(); // Give it a new ID to avoid collisions
                        Store.saveProject(project);
                        loadProjects();
                    } else {
                        alert("Invalid Mind Map JSON format.");
                    }
                } else if (file.name.endsWith('.md')) {
                    // Parse Xmind Markdown Export
                    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
                    if (lines.length === 0) return;

                    // Helper to count heading depth: "# Root" -> 1, "## Child" -> 2
                    // Or list items: "- Child" -> depth based on indent
                    const getDepth = (line: string) => {
                        const match = line.match(/^(#+)\s(.*)/);
                        if (match) return { depth: match[1].length, text: match[2].trim() };

                        const listMatch = line.match(/^(\s*)-\s(.*)/);
                        if (listMatch) {
                            return { depth: Math.floor(listMatch[1].length / 4) + 2, text: listMatch[2].trim() };
                        }
                        return null;
                    };

                    const rootData = getDepth(lines[0]) || { depth: 1, text: lines[0].replace(/^#+\s*/, '') };

                    const rootNode: any = {
                        id: crypto.randomUUID(),
                        text: rootData.text || 'Imported Mind Map',
                        children: []
                    };

                    const stack = [{ node: rootNode, depth: rootData.depth }];

                    for (let i = 1; i < lines.length; i++) {
                        const lineData = getDepth(lines[i]);
                        if (!lineData) continue;

                        const newNode = {
                            id: crypto.randomUUID(),
                            text: lineData.text,
                            children: []
                        };

                        while (stack.length > 0 && stack[stack.length - 1].depth >= lineData.depth) {
                            stack.pop();
                        }

                        if (stack.length > 0) {
                            stack[stack.length - 1].node.children.push(newNode);
                        }

                        stack.push({ node: newNode, depth: lineData.depth });
                    }

                    const projectName = file.name.replace('.md', '');
                    const newProject: ProjectData = {
                        id: crypto.randomUUID(),
                        name: projectName,
                        updatedAt: Date.now(),
                        rootNode: rootNode
                    };

                    Store.saveProject(newProject);
                    loadProjects();
                }
            } catch (err) {
                alert("Failed to parse file.");
                console.error(err);
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
                        Import Map (.json, .md)
                        <input type="file" accept=".json,.md" onChange={handleImport} style={{ display: 'none' }} />
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
