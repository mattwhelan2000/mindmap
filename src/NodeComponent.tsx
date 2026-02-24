import { useState, useRef } from 'react';
import type { NodeData } from './store';

interface NodeProps {
    node: NodeData;
    onUpdate: (id: string, text: string, image?: string, width?: number) => void;
    onAddChild: (id: string) => void;
    onDelete: (id: string) => void;
    onMoveNode: (draggedId: string, targetId: string, placement?: 'before' | 'after' | 'inside') => void;
    onToggleCollapse?: (id: string, isCollapsed: boolean) => void;
    onAddSibling?: (id: string) => void;
    selectedNodeIds?: string[];
    isRoot?: boolean;
}

export default function NodeComponent({ node, onUpdate, onAddChild, onDelete, onMoveNode, onToggleCollapse, onAddSibling, selectedNodeIds, isRoot }: NodeProps) {
    const [isEditing, setIsEditing] = useState(node.text === 'New Idea');
    const [text, setText] = useState(node.text);
    const [dragPlacement, setDragPlacement] = useState<'before' | 'after' | 'inside' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const nodeRef = useRef<HTMLDivElement>(null);

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== node.text) {
            onUpdate(node.id, text, node.image, node.width);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBlur();
            if (onAddSibling && !isRoot) {
                onAddSibling(node.id);
            }
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            handleBlur();
            onAddChild(node.id);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onUpdate(node.id, node.text, base64, node.width);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        onUpdate(node.id, node.text, undefined, node.width);
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (isRoot) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', node.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (isRoot || !nodeRef.current) {
            setDragPlacement('inside');
            return;
        }

        const rect = nodeRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height * 0.25) {
            setDragPlacement('before');
        } else if (y > rect.height * 0.75) {
            setDragPlacement('after');
        } else {
            setDragPlacement('inside');
        }
    };

    const handleDragLeave = () => {
        setDragPlacement(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const placement = dragPlacement || 'inside';
        setDragPlacement(null);

        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== node.id) {
            onMoveNode(draggedId, node.id, placement);
        }
    };

    const handleMouseUp = () => {
        // If the user manually resizes using CSS, the width on the ref changes
        if (nodeRef.current) {
            const currentWidth = nodeRef.current.getBoundingClientRect().width;
            if (node.width !== currentWidth) {
                onUpdate(node.id, node.text, node.image, currentWidth);
            }
        }
    };

    return (
        <div className="node-wrapper">
            <div
                ref={nodeRef}
                data-id={node.id}
                className={`node-content ${isRoot ? 'node-root' : ''} ${selectedNodeIds && selectedNodeIds.includes(node.id) ? 'node-selected' : ''}`}
                style={{
                    borderTop: dragPlacement === 'before' ? '3px solid var(--accent-color)' : undefined,
                    borderBottom: dragPlacement === 'after' ? '3px solid var(--accent-color)' : undefined,
                    outline: dragPlacement === 'inside' ? '3px solid var(--accent-color)' : undefined,
                    width: node.width ? `${node.width}px` : undefined
                }}
                draggable={!isEditing && !isRoot}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnter={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onMouseUp={handleMouseUp}
            >
                {node.image && (
                    <div className="node-image-container">
                        <img src={node.image} alt="Node attachment" className="node-image" />
                        <button className="remove-image-btn" onClick={handleRemoveImage}>×</button>
                    </div>
                )}

                {isEditing ? (
                    <textarea
                        autoFocus
                        className="node-input"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        rows={text.split('\n').length}
                        style={{ resize: 'none', overflow: 'hidden' }}
                    />
                ) : (
                    <div className="node-text" onClick={() => setIsEditing(true)}>
                        {node.text || 'Empty node'}
                    </div>
                )}

                <div className="node-actions" onClick={e => e.stopPropagation()}>
                    <button className="node-action-btn" title="Add Image" onClick={() => fileInputRef.current?.click()}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                    />
                    <button className="node-action-btn" title="Add Child" onClick={() => onAddChild(node.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    {!isRoot && (
                        <button className="node-action-btn delete-btn" title="Delete Node" onClick={() => onDelete(node.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    )}
                </div>

                {node.children && node.children.length > 0 && (
                    <button
                        className="node-collapse-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleCollapse) onToggleCollapse(node.id, !node.isCollapsed);
                        }}
                        title={node.isCollapsed ? "Expand Node" : "Collapse Node"}
                    >
                        {node.isCollapsed ? '+' : '-'}
                    </button>
                )}
            </div>

            {!node.isCollapsed && node.children && node.children.length > 0 && (
                <div className="node-children">
                    {node.children.map(child => (
                        <NodeComponent
                            key={child.id}
                            node={child}
                            onUpdate={onUpdate}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onMoveNode={onMoveNode}
                            onToggleCollapse={onToggleCollapse}
                            onAddSibling={onAddSibling}
                            selectedNodeIds={selectedNodeIds}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
