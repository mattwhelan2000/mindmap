import { useState, useRef } from 'react';
import type { NodeData } from './store';

interface NodeProps {
    node: NodeData;
    onUpdate: (id: string, text: string, image?: string) => void;
    onAddChild: (id: string) => void;
    onDelete: (id: string) => void;
    isRoot?: boolean;
}

export default function NodeComponent({ node, onUpdate, onAddChild, onDelete, isRoot }: NodeProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(node.text);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== node.text) {
            onUpdate(node.id, text, node.image);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleBlur();
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onUpdate(node.id, node.text, base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        onUpdate(node.id, node.text, undefined);
    };

    return (
        <div className="node-wrapper">
            <div className={`node-content ${isRoot ? 'node-root' : ''}`}>
                {node.image && (
                    <div className="node-image-container">
                        <img src={node.image} alt="Node attachment" className="node-image" />
                        <button className="remove-image-btn" onClick={handleRemoveImage}>×</button>
                    </div>
                )}

                {isEditing ? (
                    <input
                        autoFocus
                        className="node-input"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
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
            </div>

            {node.children && node.children.length > 0 && (
                <div className="node-children">
                    {node.children.map(child => (
                        <NodeComponent
                            key={child.id}
                            node={child}
                            onUpdate={onUpdate}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
