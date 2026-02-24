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
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: window.innerWidth / 2, y: 100 });
    const [isPanning, setIsPanning] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const [isMarquee, setIsMarquee] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

    const clipboardRef = useRef<NodeData[]>([]);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Pan and Zoom logic
    const handleWheel = (e: React.WheelEvent) => {
        // Scroll wheel should zoom
        const zoomFactor = 0.05;
        const newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
        setScale(Math.min(Math.max(newScale, 0.2), 3));
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
                setSelectedNodeIds([]); // click on bg clears selection
            } else {
                // If they click on a node directly, we could add it to selection
                const id = (e.target as HTMLElement).closest('.node-content')?.getAttribute('data-id');
                if (id && !e.shiftKey) {
                    setSelectedNodeIds([id]);
                } else if (id && e.shiftKey) {
                    setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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

    const handleMouseUp = () => {
        if (isMarquee) {
            const rect = {
                left: Math.min(dragStart.x, marqueeEnd.x),
                right: Math.max(dragStart.x, marqueeEnd.x),
                top: Math.min(dragStart.y, marqueeEnd.y),
                bottom: Math.max(dragStart.y, marqueeEnd.y)
            };
            const nodes = document.querySelectorAll('.node-content');
            const selected: string[] = [];
            nodes.forEach((el) => {
                const elRect = el.getBoundingClientRect();
                if (!(elRect.right < rect.left || elRect.left > rect.right || elRect.bottom < rect.top || elRect.top > rect.bottom)) {
                    const id = el.getAttribute('data-id');
                    if (id) selected.push(id);
                }
            });
            setSelectedNodeIds(selected);
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
        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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
        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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
            onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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
                onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
            }
        }
    };

    const handleToggleCollapse = (id: string, isCollapsed: boolean) => {
        const updatedRoot = updateNodeRec(project.rootNode, id, (n) => ({ ...n, isCollapsed }));
        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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

        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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
                        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
                        setSelectedNodeIds([]);
                    }
                } else if (e.key === 'v') {
                    // Paste
                    if (clipboardRef.current.length === 0) return;
                    e.preventDefault();

                    const targetId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : project.rootNode.id;
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
                    onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeIds, project.rootNode, onUpdate]);

    const handleExport = () => {
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
                    padding: '0.5rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
            >
                <button className="btn-secondary" onClick={onBack}>← Back</button>
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>{project.name}</span>
                <button className="btn-primary" onClick={handleExport}>↓ Export JSON</button>
            </div>

            <div className="canvas-zoom-controls" style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
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
