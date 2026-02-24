import { useState, useEffect } from 'react';
import { Store, generateId } from './store';
import type { ProjectData } from './store';
import JSZip from 'jszip';

interface DashboardProps {
    onOpenProject: (project: ProjectData) => void;
}

export default function Dashboard({ onOpenProject }: DashboardProps) {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editTitleText, setEditTitleText] = useState('');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = () => {
        setProjects(Store.getProjects());
    };

    const handleProjectUpdate = (updatedProject: ProjectData) => {
        Store.saveProject(updatedProject); // Assuming Store.saveProject is the correct function
        setProjects(p => p.map(proj => proj.id === updatedProject.id ? updatedProject : proj));
    };

    const handleTitleBlur = (id: string) => {
        if (editTitleText.trim() !== '') {
            const project = projects.find(p => p.id === id);
            if (project && project.name !== editTitleText.trim()) {
                const updated = { ...project, name: editTitleText.trim(), updatedAt: Date.now() };
                Store.saveProject(updated); // Assuming Store.saveProject is the correct function
                setProjects(p => p.map(proj => proj.id === id ? updated : proj));
            }
        }
        setEditingProjectId(null);
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

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.xmind')) {
                const zip = new JSZip();
                const loadedZip = await zip.loadAsync(file);
                const contentFile = loadedZip.file('content.json');

                if (!contentFile) throw new Error("Could not find content.json in Xmind file. Only Xmind 8/Zen and later are supported.");
                const contentStr = await contentFile.async('string');
                const content = JSON.parse(contentStr);

                // Usually an array of sheets, take first sheet.
                const sheet = Array.isArray(content) ? content[0] : content;
                const parseXmindNode = (topic: any): any => {
                    const childrenArr = topic.children?.attached || topic.children || [];
                    return {
                        id: generateId(),
                        text: topic.title || 'Untitled',
                        children: childrenArr.map(parseXmindNode)
                    };
                };

                const rootNode = parseXmindNode(sheet.rootTopic);
                const newProject: ProjectData = {
                    id: generateId(),
                    name: file.name.replace(/\.xmind$/i, ''),
                    updatedAt: Date.now(),
                    rootNode: rootNode
                };
                Store.saveProject(newProject);
                loadProjects();

            } else {
                const text = await file.text();
                const fileName = file.name.toLowerCase();

                if (fileName.endsWith('.json')) {
                    const data = JSON.parse(text);

                    if (data.id && data.rootNode) {
                        // Native app export
                        data.id = generateId();
                        Store.saveProject(data);
                        loadProjects();
                    } else if (data.name || data.text || data.title) {
                        // Generic JSON tree (like the user's example)
                        const parseGenericNode = (node: any): any => {
                            let nodeText = node.name || node.text || node.title || 'Untitled';
                            if (node.description) nodeText += `\n\n${node.description}`;
                            if (node.theme) nodeText += `\n\nTheme: ${node.theme}`;
                            if (node.script) nodeText += `\n\nScript: ${node.script}`;
                            if (node.synopsis && typeof node.synopsis === 'object') {
                                nodeText += `\n\nSynopsis:`;
                                for (const [key, value] of Object.entries(node.synopsis)) {
                                    nodeText += `\n• ${key}: ${value}`;
                                }
                            }
                            return {
                                id: generateId(),
                                text: nodeText,
                                image: node.image || node.img || node.thumbnail,
                                isCollapsed: !!node.isCollapsed,
                                children: Array.isArray(node.children) ? node.children.map(parseGenericNode) : []
                            };
                        };

                        const rootNode = parseGenericNode(data);
                        const newProject: ProjectData = {
                            id: generateId(),
                            name: data.name || file.name.replace(/\.json$/i, ''),
                            updatedAt: Date.now(),
                            rootNode: rootNode
                        };
                        Store.saveProject(newProject);
                        loadProjects();
                    } else {
                        throw new Error("Invalid Mind Map JSON format.");
                    }
                } else if (fileName.endsWith('.md')) {
                    // Parse Xmind Markdown Export
                    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
                    if (lines.length === 0) return;

                    const getDepth = (line: string) => {
                        const match = line.match(/^(#+)\s(.*)/);
                        if (match) return { depth: match[1].length, text: match[2].trim() };
                        const listMatch = line.match(/^(\s*)-\s(.*)/);
                        if (listMatch) return { depth: Math.floor(listMatch[1].length / 4) + 2, text: listMatch[2].trim() };
                        return null;
                    };

                    const rootData = getDepth(lines[0]) || { depth: 1, text: lines[0].replace(/^#+\s*/, '') };
                    const rootNode: any = { id: generateId(), text: rootData.text || 'Imported Mind Map', children: [] };
                    const stack = [{ node: rootNode, depth: rootData.depth }];

                    for (let i = 1; i < lines.length; i++) {
                        const lineData = getDepth(lines[i]);
                        if (!lineData) continue;
                        const newNode = { id: generateId(), text: lineData.text, children: [] };
                        while (stack.length > 0 && stack[stack.length - 1].depth >= lineData.depth) stack.pop();
                        if (stack.length > 0) stack[stack.length - 1].node.children.push(newNode);
                        stack.push({ node: newNode, depth: lineData.depth });
                    }

                    const newProject: ProjectData = {
                        id: generateId(),
                        name: file.name.replace(/\.md$/i, ''),
                        updatedAt: Date.now(),
                        rootNode: rootNode
                    };
                    Store.saveProject(newProject);
                    loadProjects();
                } else {
                    throw new Error("Unsupported file extension. Please use .json, .md, or .xmind");
                }
            }
        } catch (err: any) {
            alert(`Failed to import file: ${err.message || 'Unknown error'}`);
            console.error(err);
        }
        e.target.value = ''; // Reset
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Mindscape <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>v1.7</span></h1>
                <p>A simple, powerful mind mapping tool.</p>
                <div style={{ marginTop: '1rem' }}>
                    <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        Import Map (.json, .md, .xmind)
                        <input type="file" accept=".json,.md,.xmind" onChange={handleImport} style={{ display: 'none' }} />
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
                        {project.thumbnail && (
                            <img
                                src={project.thumbnail}
                                alt="Cover"
                                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '1rem' }}
                            />
                        )}
                        <div className="project-card-header">
                            {editingProjectId === project.id ? (
                                <input
                                    autoFocus
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 600, fontSize: '1.25rem', width: '100%', marginBottom: '0.25rem' }}
                                    value={editTitleText}
                                    onChange={e => setEditTitleText(e.target.value)}
                                    onBlur={() => handleTitleBlur(project.id)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleTitleBlur(project.id);
                                        e.stopPropagation();
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="project-card-title"
                                    style={{ cursor: 'text' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProjectId(project.id);
                                        setEditTitleText(project.name);
                                    }}
                                    title="Click to rename"
                                >
                                    {project.name}
                                </span>
                            )}
                            <button
                                className="btn-danger"
                                onClick={(e) => handleDelete(e, project.id)}
                                title="Delete Project"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="project-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Last updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
                            <label onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.875rem' }}>
                                Add Image
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                const base64 = event.target?.result as string;
                                                const updated = { ...project, thumbnail: base64 };
                                                Store.saveProject(updated);
                                                loadProjects();
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                            </label>
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
