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
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);

    // Pan and Zoom logic
    const handleWheel = (e: React.WheelEvent) => {
        // Any wheel action should zoom
        const zoomFactor = 0.05;
        const newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
        setScale(Math.min(Math.max(newScale, 0.2), 3));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Allow dragging from anywhere EXCEPT inside a node input/button
        if ((e.target as HTMLElement).closest('.node-input, button, .node-action-btn, .node-children')) {
            // Let the user interact with the node elements
            if (!(e.target as HTMLElement).classList.contains('node-children')) {
                return;
            }
        }

        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
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

    const handleNodeUpdate = (id: string, text: string, image?: string) => {
        const updatedRoot = updateNodeRec(project.rootNode, id, (n) => ({ ...n, text, image }));
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
            children: [...n.children, newNode]
        }));
        onUpdate({ ...project, rootNode: updatedRoot, updatedAt: Date.now() });
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

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `MindMap_${project.name.replace(/\s+/g, '_')}.json`;
        a.click();
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
            style={{
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                position: 'relative',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
        >
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
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <NodeComponent
                    node={project.rootNode}
                    onUpdate={handleNodeUpdate}
                    onAddChild={handleAddChild}
                    onDelete={handleDeleteNode}
                    onMoveNode={handleMoveNode}
                    onToggleCollapse={handleToggleCollapse}
                    isRoot={true}
                />
            </div>
        </div>
    );
}
