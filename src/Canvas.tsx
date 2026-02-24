import { useState, useRef, useEffect } from 'react';
import type { ProjectData, NodeData } from './store';
import { generateId } from './store';
import NodeComponent from './NodeComponent';

interface CanvasProps {
    project: ProjectData;
    onBack: () => void;
    onUpdate: (project: ProjectData) => void;
}

export default function Canvas({ project, onBack, onUpdate }: CanvasProps) {
    const [scale, setScale] = useState(project.canvasScale ?? 1);
    const [position, setPosition] = useState(project.canvasPosition ?? { x: window.innerWidth / 2, y: 100 });
    const [isPanning, setIsPanning] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const [isMarquee, setIsMarquee] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [history, setHistory] = useState<NodeData[]>([]);

    // Title Editing State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleText, setTitleText] = useState(project.name);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const clipboardRef = useRef<NodeData[]>([]);
    const canvasRef = useRef<HTMLDivElement>(null);

    const commitUpdate = (newRoot: NodeData, newTitle?: string) => {
        setHistory(prev => [...prev.slice(-49), project.rootNode]);
        onUpdate({ ...project, rootNode: newRoot, name: newTitle ?? project.name, updatedAt: Date.now() });
    };

    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (titleText.trim() !== '' && titleText !== project.name) {
            commitUpdate(project.rootNode, titleText.trim());
        } else {
            setTitleText(project.name);
        }
    };

    // Pan and Zoom logic
    const handleWheel = (e: React.WheelEvent) => {
        const zoomFactor = 0.05;
        const newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
        const safeScale = Math.min(Math.max(newScale, 0.2), 3);

        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            const ratio = safeScale / scale;
            const newX = mouseX - (mouseX - position.x) * ratio;
            const newY = mouseY - (mouseY - position.y) * ratio;

            setPosition({ x: newX, y: newY });
        }

        setScale(safeScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.node-input, button, .node-action-btn, .node-children')) {
            if (!(e.target as HTMLElement).classList.contains('node-children')) {
                return;
            }
        }

        if (e.button === 1) { // MMB
            e.preventDefault();
            setIsPanning(true);
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (e.button === 2) { // RMB
            e.preventDefault();
            setIsZooming(true);
            setDragStart({ x: e.clientY, y: e.clientY }); // Track Y for zoom
        } else if (e.button === 0) { // LMB
            if (!(e.target as HTMLElement).closest('.node-content')) {
                setIsMarquee(true);
                setDragStart({ x: e.clientX, y: e.clientY });
                setMarqueeEnd({ x: e.clientX, y: e.clientY });
                if (!e.shiftKey && !e.altKey) {
                    setSelectedNodeIds([]); // click on bg clears selection unless modifying
                }
            } else {
                // If they click on a node directly
                const id = (e.target as HTMLElement).closest('.node-content')?.getAttribute('data-id');
                if (id) {
                    if (e.altKey) {
                        setSelectedNodeIds(prev => prev.filter(i => i !== id));
                    } else if (e.shiftKey) {
                        setSelectedNodeIds(prev => prev.includes(id) ? prev : [...prev, id]);
                    } else {
                        setSelectedNodeIds([id]);
                    }
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (isZooming) {
            const dy = dragStart.y - e.clientY;
            const zoomFactor = dy * 0.01;
            setScale(s => Math.min(Math.max(s + zoomFactor, 0.2), 3));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (isMarquee) {
            setMarqueeEnd({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isMarquee) {
            const rect = {
                left: Math.min(dragStart.x, marqueeEnd.x),
                right: Math.max(dragStart.x, marqueeEnd.x),
                top: Math.min(dragStart.y, marqueeEnd.y),
                bottom: Math.max(dragStart.y, marqueeEnd.y)
            };
            const nodes = document.querySelectorAll('.node-content');
            const selectedSet = new Set(selectedNodeIds);

            if (!e.shiftKey && !e.altKey) {
                selectedSet.clear();
            }

            nodes.forEach((el) => {
                const elRect = el.getBoundingClientRect();
                if (!(elRect.right < rect.left || elRect.left > rect.right || elRect.bottom < rect.top || elRect.top > rect.bottom)) {
                    const id = el.getAttribute('data-id');
                    if (id) {
                        if (e.altKey) {
                            selectedSet.delete(id);
                        } else {
                            selectedSet.add(id);
                        }
                    }
                }
            });
            setSelectedNodeIds(Array.from(selectedSet));
        }

        setIsPanning(false);
        setIsZooming(false);
        setIsMarquee(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); // allow RMB dragging without context menu
    };

    // Node operations
    const updateNodeRec = (node: NodeData, targetId: string, updater: (n: NodeData) => NodeData): NodeData => {
        if (node.id === targetId) {
            return updater({ ...node });
        }
        return {
            ...node,
            children: node.children.map(child => updateNodeRec(child, targetId, updater))
        };
    };

    const deleteNodeRec = (node: NodeData, targetId: string): NodeData | null => {
        if (node.id === targetId) return null; // Root cannot be deleted this way, usually handled earlier
        return {
            ...node,
            children: node.children
                .map(child => deleteNodeRec(child, targetId))
                .filter((c): c is NodeData => c !== null)
        };
    };

    const handleNodeUpdate = (id: string, text: string, image?: string, width?: number) => {
        const updatedRoot = updateNodeRec(project.rootNode, id, (n) => ({ ...n, text, image, width }));
        commitUpdate(updatedRoot);
    };

    const handleAddChild = (parentId: string) => {
        const newNode: NodeData = {
            id: generateId(),
            text: 'New Idea',
            children: []
        };
        const updatedRoot = updateNodeRec(project.rootNode, parentId, (n) => ({
            ...n,
            isCollapsed: false,
            children: [...n.children, newNode]
        }));
        commitUpdate(updatedRoot);
    };

    const handleAddSibling = (targetId: string) => {
        if (targetId === project.rootNode.id) return;

        let parentId: string | null = null;
        let insertIndex = -1;
        const findParent = (node: NodeData, id: string): boolean => {
            const idx = node.children.findIndex(c => c.id === id);
            if (idx !== -1) {
                parentId = node.id;
                insertIndex = idx;
                return true;
            }
            return node.children.some(c => findParent(c, id));
        };
        findParent(project.rootNode, targetId);

        if (parentId && insertIndex !== -1) {
            const newNode: NodeData = {
                id: generateId(),
                text: 'New Idea',
                children: []
            };
            const updatedRoot = updateNodeRec(project.rootNode, parentId, (n) => {
                const newChildren = [...n.children];
                newChildren.splice(insertIndex + 1, 0, newNode);
                return { ...n, children: newChildren, isCollapsed: false };
            });
            commitUpdate(updatedRoot);
        }
    };

    const handleDeleteNode = (id: string) => {
        if (id === project.rootNode.id) {
            alert("Cannot delete the root node.");
            return;
        }
        if (confirm('Delete this branch?')) {
            const updatedRoot = deleteNodeRec(project.rootNode, id);
            if (updatedRoot) {
                commitUpdate(updatedRoot);
            }
        }
    };

    const handleToggleCollapse = (id: string, isCollapsed: boolean) => {
        const updatedRoot = updateNodeRec(project.rootNode, id, (n) => ({ ...n, isCollapsed }));
        commitUpdate(updatedRoot);
    };

    const handleMoveNode = (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;

        let isDescendant = false;
        const checkDescendant = (n: NodeData) => {
            if (n.id === targetId) isDescendant = true;
            n.children.forEach(checkDescendant);
        };

        let draggedNode: NodeData | null = null;
        const findAndCheck = (n: NodeData) => {
            if (n.id === draggedId) {
                draggedNode = JSON.parse(JSON.stringify(n));
                checkDescendant(n);
            }
            if (!draggedNode) n.children.forEach(findAndCheck);
        };
        findAndCheck(project.rootNode);

        if (isDescendant || !draggedNode) return;

        const rootAfterDelete = deleteNodeRec(project.rootNode, draggedId);
        if (!rootAfterDelete) return;

        const updatedRoot = updateNodeRec(rootAfterDelete, targetId, (n) => ({
            ...n,
            children: [...n.children, draggedNode!]
        }));

        commitUpdate(updatedRoot);
    };

    const getTopLevelSelectedNodes = (root: NodeData, ids: string[]): NodeData[] => {
        let result: NodeData[] = [];
        if (ids.includes(root.id)) {
            result.push(JSON.parse(JSON.stringify(root)));
        } else {
            root.children.forEach(c => result.push(...getTopLevelSelectedNodes(c, ids)));
        }
        return result;
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    // Copy
                    const nodesToCopy = getTopLevelSelectedNodes(project.rootNode, selectedNodeIds);
                    if (nodesToCopy.length > 0) clipboardRef.current = nodesToCopy;
                } else if (e.key === 'x') {
                    // Cut
                    const nodesToCopy = getTopLevelSelectedNodes(project.rootNode, selectedNodeIds);
                    if (nodesToCopy.length > 0) {
                        clipboardRef.current = nodesToCopy;
                        let updatedRoot = project.rootNode;
                        for (const id of selectedNodeIds) {
                            if (id !== project.rootNode.id) {
                                const res = deleteNodeRec(updatedRoot, id);
                                if (res) updatedRoot = res;
                            }
                        }
                        commitUpdate(updatedRoot);
                        setSelectedNodeIds([]);
                    }
                } else if (e.key === 'v') {
                    // Paste
                    if (clipboardRef.current.length === 0) return;
                    e.preventDefault();

                    const targetId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : project.rootNode.id;
                    const cloneAndNewIds = (n: NodeData): NodeData => ({
                        ...n,
                        id: generateId(),
                        children: n.children.map(cloneAndNewIds)
                    });

                    const newNodes = clipboardRef.current.map(cloneAndNewIds);
                    const updatedRoot = updateNodeRec(project.rootNode, targetId, (n) => ({
                        ...n,
                        children: [...n.children, ...newNodes],
                        isCollapsed: false
                    }));
                    commitUpdate(updatedRoot);
                } else if (e.key === 'z') {
                    // Undo
                    e.preventDefault();
                    if (history.length > 0) {
                        const previousRoot = history[history.length - 1];
                        setHistory(prev => prev.slice(0, -1));
                        onUpdate({ ...project, rootNode: previousRoot, updatedAt: Date.now() });
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeIds.length > 0) {
                    let updatedRoot = project.rootNode;
                    for (const id of selectedNodeIds) {
                        if (id !== project.rootNode.id) {
                            const res = deleteNodeRec(updatedRoot, id);
                            if (res) updatedRoot = res;
                        }
                    }
                    if (updatedRoot !== project.rootNode) {
                        commitUpdate(updatedRoot);
                        setSelectedNodeIds([]);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeIds, project.rootNode, onUpdate, history]);

    const handleExportJSON = () => {
        const jsonStr = JSON.stringify(project);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MindMap_${project.name.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const exportToMarkdownRec = (node: NodeData, depth: number): string => {
        let md = `${'#'.repeat(depth + 1)} ${node.text}\n\n`;
        if (node.image) {
            md += `![Image for ${node.text}](${node.image})\n\n`;
        }
        for (const child of node.children) {
            md += exportToMarkdownRec(child, depth + 1);
        }
        return md;
    };

    const handleExportMarkdown = () => {
        const mdContent = exportToMarkdownRec(project.rootNode, 0);
        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MindMap_${project.name.replace(/\s+/g, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const handleExportPDF = () => {
        alert("Native client-side PDF export requires external libraries like html2canvas and jsPDF to capture the DOM reliably. As a workaround until this is integrated, please hit Ctrl+P to print the webpage, and select 'Save to PDF' as the destination.");
        setShowExportMenu(false);
    };

    // Ensure wheel event is non-passive to allow e.preventDefault()
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const preventDefaultWheel = (e: WheelEvent) => {
            e.preventDefault(); // Prevent full page scroll when zooming on canvas
        };
        el.addEventListener('wheel', preventDefaultWheel, { passive: false });
        return () => el.removeEventListener('wheel', preventDefaultWheel);
    }, []);

    // Persist position and scale
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (project.canvasScale !== scale || project.canvasPosition?.x !== position.x || project.canvasPosition?.y !== position.y) {
                onUpdate({ ...project, canvasScale: scale, canvasPosition: position, updatedAt: Date.now() });
            }
        }, 800);
        return () => clearTimeout(timeout);
    }, [scale, position, project, onUpdate]);

    return (
        <div
            className="canvas-container canvas-background"
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            style={{
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                position: 'relative',
                cursor: isPanning ? 'grabbing' : isZooming ? 'ns-resize' : 'default',
                userSelect: isMarquee ? 'none' : 'auto'
            }}
        >
            {isMarquee && (
                <div style={{
                    position: 'absolute',
                    border: '1px solid var(--accent-color)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    pointerEvents: 'none',
                    zIndex: 100,
                    left: Math.min(dragStart.x, marqueeEnd.x),
                    top: Math.min(dragStart.y, marqueeEnd.y),
                    width: Math.abs(dragStart.x - marqueeEnd.x),
                    height: Math.abs(dragStart.y - marqueeEnd.y)
                }} />
            )}

            <div
                className="canvas-toolbar"
                style={{
                    position: 'absolute', top: 20, left: 20, zIndex: 10,
                    display: 'flex', gap: '1rem', background: 'var(--bg-secondary)',
                    padding: '0.5rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    alignItems: 'center'
                }}
            >
                <button className="btn-secondary" onClick={onBack}>← Back</button>
                {isEditingTitle ? (
                    <input
                        autoFocus
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 500, fontSize: '1rem', width: '200px' }}
                        value={titleText}
                        onChange={e => setTitleText(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); }}
                    />
                ) : (
                    <span
                        style={{ fontWeight: 500, cursor: 'text', padding: '0 0.5rem' }}
                        onClick={() => setIsEditingTitle(true)}
                        title="Click to rename"
                    >
                        {project.name}
                    </span>
                )}
                <div style={{ position: 'relative' }}>
                    <button className="btn-primary" onClick={() => setShowExportMenu(!showExportMenu)}>Share ▾</button>
                    {showExportMenu && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)', minWidth: '150px', zIndex: 20
                        }}>
                            <button className="btn-secondary" style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '0.5rem 1rem', borderRadius: 0 }} onClick={handleExportJSON}>Export JSON</button>
                            <button className="btn-secondary" style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '0.5rem 1rem', borderRadius: 0 }} onClick={handleExportMarkdown}>Export Markdown</button>
                            <button className="btn-secondary" style={{ border: 'none', background: 'transparent', textAlign: 'left', padding: '0.5rem 1rem', borderRadius: 0 }} onClick={handleExportPDF}>Export PDF</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="canvas-zoom-controls" style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => { setScale(1); setPosition({ x: window.innerWidth / 2, y: 100 }); }} title="Re-Center">⌖</button>
                <button className="btn-secondary" onClick={() => setScale(s => Math.max(0.2, s - 0.2))}>-</button>
                <span style={{ display: 'flex', alignItems: 'center', width: '40px', justifyContent: 'center' }}>{Math.round(scale * 100)}%</span>
                <button className="btn-secondary" onClick={() => setScale(s => Math.min(3, s + 0.2))}>+</button>
            </div>

            <div
                className="canvas-surface canvas-background"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <NodeComponent
                    node={project.rootNode}
                    onUpdate={handleNodeUpdate}
                    onAddChild={handleAddChild}
                    onDelete={handleDeleteNode}
                    onMoveNode={handleMoveNode}
                    onToggleCollapse={handleToggleCollapse}
                    onAddSibling={handleAddSibling}
                    selectedNodeIds={selectedNodeIds}
                    isRoot={true}
                />
            </div>
        </div>
    );
}
