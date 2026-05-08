import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import closeIcon from '../assets/icons/close.svg';
import maximizeIcon from '../assets/icons/maximize.svg';
import rotateIcon from '../assets/icons/rotate.svg';
import checkIcon from '../assets/icons/todos.svg';
import editIcon from '../assets/icons/edit.svg';
import zapIcon from '../assets/icons/zap.svg';
import upIcon from '../assets/icons/chevron-up.svg';
import downIcon from '../assets/icons/chevron-down.svg';
import leftIcon from '../assets/icons/chevron-left.svg';
import rightIcon from '../assets/icons/chevron-right.svg';
import chartIcon from '../assets/icons/chart.svg';
import journalIcon from '../assets/icons/journal.svg';
import brainIcon from '../assets/icons/brain.svg';
const fs = window.require('fs').promises;
const path = window.require('path');

// --- CONSTANTS ---
const DB_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Workflows';
const INDEX_FILE = path.join(DB_PATH, 'index.json');
const getRoadmapFile = (id) => path.join(DB_PATH, `roadmap_${id}.json`);

// --- SVG ICON HELPER (Consistent with other files) ---
const LocalIcon = ({ src, size = 16, className = "", opacity = "opacity-100" }) => (
    <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className={`filter brightness-0 invert ${opacity} ${className}`}
    />
);

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const snapToGrid = (val) => Math.round(val / 20) * 20;

const Connection = React.memo(({ conn, start, end, fromNode, toNode, onDelete }) => {
    const fromH = conn.fromHandle || 'right';
    const toH = conn.toHandle || 'left';

    let pathData = `M ${start.x} ${start.y} `;
    const offset = 24;

    if (fromH === 'bottom' && toH === 'top') {
        const midY = start.y + (end.y - start.y) / 2;
        pathData += `L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    } else if (fromH === 'bottom' && (toH === 'left' || toH === 'right')) {
        // Use toNode.y (top edge) so the vertical drop matches bottom→top connections
        const topY = toNode ? toNode.y : end.y;
        const midY = start.y + (topY - start.y) / 2;
        const targetX = toH === 'left' ? (end.x - offset) : (end.x + offset);
        pathData += `L ${start.x} ${midY} L ${targetX} ${midY} L ${targetX} ${end.y} L ${end.x} ${end.y}`;
    } else if ((fromH === 'right' || fromH === 'left') && toH === 'top') {
        // Go straight horizontally to the target's X, then drop down to the target
        pathData += `L ${end.x} ${start.y} L ${end.x} ${end.y}`;
    } else if (fromH === 'right' || fromH === 'left') {
        // Strict 3-segment routing anchored to the TARGET handle's projection
        const pX = toH === 'left' ? (end.x - offset) : (toH === 'right' ? (end.x + offset) : (fromH === 'right' ? start.x + offset : start.x - offset));

        // Path: Start -> Project to pX -> Drop to end.y -> End
        pathData += `L ${pX} ${start.y} L ${pX} ${end.y} L ${end.x} ${end.y}`;
    } else {
        const midY = start.y + (end.y - start.y) / 2;
        pathData += `L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    }

    return (
        <g onClick={(e) => { e.stopPropagation(); onDelete(conn.id); }} className="pointer-events-auto cursor-pointer group hover:opacity-100">
            <path d={pathData} stroke="transparent" strokeWidth="15" fill="none" />
            <path
                d={pathData}
                stroke="#3f3f46"
                strokeWidth="4"
                fill="none"
                className="group-hover:stroke-blue-500 transition-colors"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </g>
    );
},
    (prev, next) => {
        return prev.conn.id === next.conn.id &&
            prev.start.x === next.start.x && prev.start.y === next.start.y &&
            prev.end.x === next.end.x && prev.end.y === next.end.y &&
            prev.fromNode?.x === next.fromNode?.x && prev.fromNode?.y === next.fromNode?.y &&
            prev.toNode?.x === next.toNode?.x && prev.toNode?.y === next.toNode?.y &&
            prev.toNode?.width === next.toNode?.width;
    });

const COLORS = {
    blue: { bg: 'bg-[#1a1b26]', border: 'border-blue-500/50', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
    red: { bg: 'bg-[#261a1a]', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-red-500/20' },
    green: { bg: 'bg-[#1a261a]', border: 'border-green-500/50', text: 'text-green-400', glow: 'shadow-green-500/20' },
    purple: { bg: 'bg-[#201a26]', border: 'border-purple-500/50', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
    yellow: { bg: 'bg-[#26261a]', border: 'border-yellow-500/50', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
    orange: { bg: 'bg-[#26201a]', border: 'border-orange-500/50', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
};

// --- COMPONENTS ---

// --- CONSTANTS ---
const SIZE_MAP = {
    xs: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
    xxl: 'text-lg'
};

const Card = React.memo(({ node, isSelected, isDraggingNode, potentialTargetId, onMouseDown, onHandleMouseDown, onDelete, onResize, onUpdate }) => {
    const theme = COLORS[node.color] || COLORS.blue;
    const height = node.height || 50;
    const isSection = node.type === 'section';
    const isSubCard = node.type === 'sub-card';
    const isTextNote = node.type === 'text-note';
    const isTodoList = node.type === 'todo-list';

    // Dynamic Text Styles
    const fontSizeClass = SIZE_MAP[node.fontSize] || (isTextNote ? SIZE_MAP.lg : SIZE_MAP.md);
    const fontWeightClass = node.fontWeight === 'normal' ? 'font-normal' : (node.fontWeight === 'bold' ? 'font-bold' : (isTextNote ? 'font-medium' : 'font-bold'));
    const italicClass = node.fontStyle === 'italic' ? 'italic' : '';

    return (
        <div
            className={`absolute flex flex-col rounded-xl select-none transition-shadow duration-200 group
                ${isSection ? 'bg-transparent border-2 border-solid pointer-events-none z-10' : 'z-20'} 
                ${isTextNote ? 'border-none bg-transparent shadow-none items-center justify-center' : 'bg-opacity-100 border border-solid ' + theme.bg + ' ' + theme.border}
                ${isSubCard ? 'border-dashed' : ''}
                ${isSelected ? `shadow-2xl ring-1 ring-white/20 z-[100] scale-[1.02]` : (isTextNote ? '' : 'shadow-lg hover:shadow-xl')}
                ${potentialTargetId === node.id ? 'ring-4 ring-blue-400/50 scale-[1.03] shadow-blue-500/40' : ''}
            `}
            style={{
                left: node.x,
                top: node.y,
                width: node.width || 240,
                height: isTodoList ? 'fit-content' : height,
                minHeight: isTodoList ? height : undefined,
                cursor: isTextNote ? 'text' : (isDraggingNode === node.id ? 'grabbing' : 'grab'),
                transform: `rotate(${node.rotation || 0}deg)`,
                willChange: isSelected ? 'transform, width, height' : 'auto'
            }}
            onMouseDown={(e) => !isSection && onMouseDown(e, node.id)}
            onWheel={(e) => isTodoList && e.stopPropagation()}
        >
            {/* Header / Drag Handle */}
            {isTodoList ? (
                <div
                    className="w-full h-full flex flex-col pointer-events-auto p-4 gap-3"
                    onMouseDown={(e) => onMouseDown(e, node.id)}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">
                            {node.title || "TODO"}
                        </span>
                        <button
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                onDelete(node.id);
                            }}
                            className="text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                        >
                            <LocalIcon src={closeIcon} size={14} />
                        </button>
                    </div>

                    <div className="space-y-2 pr-1">
                        {(node.tasks || []).map(task => (
                            <div key={task.id} className="flex items-center gap-2 group/task">
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedTasks = node.tasks.map(t =>
                                            t.id === task.id ? { ...t, completed: !t.completed } : t
                                        );
                                        onUpdate(node.id, { tasks: updatedTasks });
                                    }}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${task.completed ? 'bg-blue-500 border-blue-500' : 'border-white/20 hover:border-white/40'}`}
                                >
                                    {task.completed && <LocalIcon src={closeIcon} size={10} className="brightness-0" />}
                                </button>
                                <span className={`flex-1 ${fontSizeClass} ${fontWeightClass} ${italicClass} ${task.completed ? 'text-white/30 line-through' : 'text-white/90'}`}>
                                    {task.text}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                    <button
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-white/20 hover:text-blue-400 transition-colors p-1 cursor-pointer"
                                    >
                                        <LocalIcon src={editIcon} size={14} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updatedTasks = node.tasks.filter(t => t.id !== task.id);
                                            onUpdate(node.id, { tasks: updatedTasks });
                                        }}
                                        className="text-white/20 hover:text-red-400 transition-colors p-1 cursor-pointer"
                                    >
                                        <LocalIcon src={closeIcon} size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Ghost Line for new tasks */}
                        <div className="flex items-center gap-2 group/ghost">
                            <div className="w-4 h-4 rounded border border-white/10 flex items-center justify-center opacity-40">
                                <LocalIcon src={plusIcon} size={8} />
                            </div>
                            <input
                                type="text"
                                placeholder="Add task..."
                                className={`flex-1 bg-transparent border-none py-0.5 ${fontSizeClass} ${fontWeightClass} ${italicClass} text-white/40 outline-none focus:text-white/90 placeholder:text-white/20 select-text`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        const newTask = { id: Date.now().toString(), text: e.target.value.trim(), completed: false };
                                        onUpdate(node.id, { tasks: [...(node.tasks || []), newTask] });
                                        e.target.value = '';
                                    }
                                    e.stopPropagation();
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                </div>
            ) : isTextNote ? (
                <div
                    className="w-full h-full flex items-center justify-center pointer-events-auto px-4"
                    onMouseDown={(e) => onMouseDown(e, node.id)}
                >
                    <span className={`${fontSizeClass} ${fontWeightClass} ${italicClass} text-white whitespace-normal break-words text-center`}>
                        {node.title || "Note"}
                    </span>
                    <button
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onDelete(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-all z-50 cursor-pointer"
                    >
                        <LocalIcon src={closeIcon} size={10} />
                    </button>
                </div>
            ) : (
                <div
                    className={`${isSection ? 'h-8 pointer-events-auto' : 'h-full pointer-events-auto'} px-4 flex justify-center items-center rounded-xl select-none relative`}
                    onMouseDown={(e) => onMouseDown(e, node.id)}
                >
                    <div className="flex items-center gap-2">
                        <span className={`${fontSizeClass} ${fontWeightClass} ${italicClass} uppercase tracking-widest text-white/90 whitespace-normal break-words py-2 text-center`}>
                            {node.title || "UNTITLED"}
                        </span>
                    </div>
                    <button
                        onMouseDown={(e) => {
                            if (e.ctrlKey) return;
                            e.stopPropagation();
                            onDelete(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400 absolute right-4 cursor-pointer"
                    >
                        <LocalIcon src={closeIcon} size={12} opacity="opacity-40" />
                    </button>
                </div>
            )}

            {/* Resize Handles - Corners */}
            <div className={`absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize z-40 opacity-0 hover:opacity-100 pointer-events-auto`}
                onMouseDown={(e) => onResize(e, node.id, 'nw')} />
            <div className={`absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize z-40 opacity-0 hover:opacity-100 pointer-events-auto`}
                onMouseDown={(e) => onResize(e, node.id, 'ne')} />
            <div className={`absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize z-40 opacity-0 hover:opacity-100 pointer-events-auto`}
                onMouseDown={(e) => onResize(e, node.id, 'sw')} />
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize z-40 opacity-0 hover:opacity-100 pointer-events-auto`}
                onMouseDown={(e) => onResize(e, node.id, 'se')} />

            {/* Connection Handles - Visible only on Hover */}
            <div
                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black border ${theme.border} flex items-center justify-center cursor-crosshair hover:scale-110 transition-transform z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto`}
                onMouseDown={(e) => onHandleMouseDown(e, node.id, 'right')}
            >
                <div className={`w-2 h-2 rounded-full ${theme.text.replace('text', 'bg')}`}></div>
            </div>
            <div
                className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black border ${theme.border} flex items-center justify-center cursor-crosshair hover:scale-110 transition-transform z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto`}
                onMouseDown={(e) => onHandleMouseDown(e, node.id, 'left')}
            >
                <div className={`w-2 h-2 rounded-full ${theme.text.replace('text', 'bg')}`}></div>
            </div>
            <div
                className={`absolute left-1/2 -ml-3 -top-3 w-6 h-6 rounded-full bg-black border ${theme.border} flex items-center justify-center cursor-crosshair hover:scale-110 transition-transform z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto`}
                onMouseDown={(e) => onHandleMouseDown(e, node.id, 'top')}
            >
                <div className={`w-2 h-2 rounded-full ${theme.text.replace('text', 'bg')}`}></div>
            </div>
            <div
                className={`absolute left-1/2 -ml-3 -bottom-3 w-6 h-6 rounded-full bg-black border ${theme.border} flex items-center justify-center cursor-crosshair hover:scale-110 transition-transform z-20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto`}
                onMouseDown={(e) => onHandleMouseDown(e, node.id, 'bottom')}
            >
                <div className={`w-2 h-2 rounded-full ${theme.text.replace('text', 'bg')}`}></div>
            </div>
        </div>
    );
});

// --- MAIN CANVAS ---

const WorkflowCanvas = ({ showNavbar = true }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [roadmapsList, setRoadmapsList] = useState([]);
    const [activeRoadmapId, setActiveRoadmapId] = useState(() => {
        if (location.state?.roadmapId) return location.state.roadmapId;
        if (location.state?.exitedToHub) return null;
        return localStorage.getItem('last_opened_roadmap') || null;
    });

    const [nodes, setNodes] = useState([]);
    const [connections, setConnections] = useState([]);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDraggingNode, setIsDraggingNode] = useState(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [connectionStart, setConnectionStart] = useState(null); // { nodeId, handle, x, y }
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [selectedNodeIds, setSelectedNodeIds] = useState([]);
    const [potentialTargetId, setPotentialTargetId] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null); // { startX, startY, currentX, currentY }
    const [sidebarOpenNodeId, setSidebarOpenNodeId] = useState(null);
    const [clipboard, setClipboard] = useState({ nodes: [], connections: [] }); // { nodes, connections }
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [snapGuide, setSnapGuide] = useState(null); // { y }
    const [showClearModal, setShowClearModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createRoadmapTitle, setCreateRoadmapTitle] = useState("");
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const moveStartSnapshotRef = useRef(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const sidebarInputRef = useRef(null);


    const clipboardRef = useRef({ nodes: [], connections: [] });

    // Sync clipboard ref
    useEffect(() => {
        clipboardRef.current = clipboard;
    }, [clipboard]);
    const nodeMap = useMemo(() => {
        const map = new Map();
        nodes.forEach(n => map.set(n.id, n));
        return map;
    }, [nodes]);

    const pushToHistory = useCallback((nodesToLog, connectionsToLog) => {
        setUndoStack(prev => {
            const newStack = [...prev, { nodes: [...nodesToLog], connections: [...connectionsToLog] }];
            return newStack.slice(-30); // Store up to 30 history states
        });
        setRedoStack([]); // Clear redo on new action
    }, []);

    const undo = useCallback(() => {
        if (undoStack.length === 0) return;
        const lastState = undoStack[undoStack.length - 1];
        
        setRedoStack(prev => {
            const newStack = [...prev, { nodes: [...nodes], connections: [...connections] }];
            return newStack.slice(-30);
        });
        
        setNodes(lastState.nodes);
        setConnections(lastState.connections);
        saveData(lastState.nodes, lastState.connections);
        
        // Reset selection and sidebar to stay in sync with history
        setSelectedNodeIds([]);
        setSidebarOpenNodeId(null);
        
        setUndoStack(prev => prev.slice(0, -1));
    }, [undoStack, nodes, connections]);

    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        
        setUndoStack(prev => {
            const newStack = [...prev, { nodes: [...nodes], connections: [...connections] }];
            return newStack.slice(-30);
        });
        
        setNodes(nextState.nodes);
        setConnections(nextState.connections);
        saveData(nextState.nodes, nextState.connections);
        
        // Reset selection and sidebar
        setSelectedNodeIds([]);
        setSidebarOpenNodeId(null);
        
        setRedoStack(prev => prev.slice(0, -1));
    }, [redoStack, nodes, connections]);


    const [resizingState, setResizingState] = useState(null);

    const isInteracting = !!isDraggingNode || !!isPanning || !!resizingState || !!connectionStart || !!selectionBox;
    const showSidebar = !!sidebarOpenNodeId && selectedNodeIds.length === 1 && selectedNodeIds[0] === sidebarOpenNodeId && !isInteracting;
    const containerRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);
    const nodesRef = useRef([]); // Keep sync for event handlers
    const lastUpdateRef = useRef(0); // For throttling
    const layoutCacheRef = useRef(null); // Cache BCR to avoid reflows during drag
    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);

    // Sync refs
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);

    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);


    // Auto-focus and select sidebar input when opening or switching nodes
    useEffect(() => {
        if (showSidebar && sidebarInputRef.current) {
            // Small timeout to ensure the sidebar transition/render is underway
            const timer = setTimeout(() => {
                sidebarInputRef.current?.focus();
                sidebarInputRef.current?.select();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [selectedNodeIds[0], showSidebar]);


    // --- PERSISTENCE ---
    const loadIndex = async () => {
        try {
            await fs.mkdir(DB_PATH, { recursive: true });
            const files = await fs.readdir(DB_PATH);
            const roadmapFiles = files.filter(f => f.startsWith('roadmap_') && f.endsWith('.json'));

            let list = [];
            // Try to load existing index first to preserve titles
            try {
                const content = await fs.readFile(INDEX_FILE, 'utf-8');
                list = content.trim() ? JSON.parse(content) : [];
            } catch (e) { }
            if (!Array.isArray(list)) list = [];

            const indexedIds = new Set(list.map(r => r.id));
            let changed = false;

            for (const file of roadmapFiles) {
                // Extract ID: skip 'roadmap_' prefix and '.json' suffix
                const id = file.slice(8, -5);
                if (!indexedIds.has(id)) {
                    try {
                        const roadmapContent = await fs.readFile(path.join(DB_PATH, file), 'utf-8');
                        const data = JSON.parse(roadmapContent);
                        list.push({
                            id,
                            title: 'Recovered Roadmap',
                            createdAt: new Date().toISOString(),
                            lastModified: new Date().toISOString(),
                            nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0
                        });
                        changed = true;
                    } catch (e) { }
                }
            }

            // Cleanup index: remove entries whose files no longer exist
            const existingFileIds = new Set(roadmapFiles.map(f => f.slice(8, -5)));
            const cleanedList = list.filter(r => existingFileIds.has(r.id));
            if (cleanedList.length !== list.length) {
                list = cleanedList;
                changed = true;
            }

            if (changed) {
                await saveIndex(list);
            }
            setRoadmapsList(list);
        } catch (e) { console.error("Index load failed", e); }
    };

    const saveIndex = async (list) => {
        try {
            await fs.mkdir(DB_PATH, { recursive: true });
            await fs.writeFile(INDEX_FILE, JSON.stringify(list, null, 2));
        } catch (e) { console.error("Index save failed", e); }
    };

    const loadRoadmap = async (id) => {
        try {
            // Try multiple filename patterns to be extremely resilient to ID prefixing inconsistencies
            const filesToTry = [
                path.join(DB_PATH, `roadmap_${id}.json`),
                path.join(DB_PATH, `${id}.json`),
                path.join(DB_PATH, id.startsWith('roadmap_') ? id + '.json' : `roadmap_${id}.json`)
            ];

            let content = '';
            let successFile = '';
            for (const f of filesToTry) {
                try {
                    const data = await fs.readFile(f, 'utf-8');
                    if (data && data.trim()) {
                        content = data;
                        successFile = f;
                        break;
                    }
                } catch (e) { }
            }

            if (!content) {
                console.error("Could not find roadmap file for ID:", id, "Tried:", filesToTry);
                setNodes([]);
                setConnections([]);
                return;
            }

            const data = JSON.parse(content);
            setNodes(Array.isArray(data.nodes) ? data.nodes : []);
            setConnections(Array.isArray(data.connections) ? data.connections : []);

            try {
                const positions = JSON.parse(localStorage.getItem('roadmap_positions') || '{}');
                if (positions[id]) {
                    setScale(positions[id].scale);
                    setOffset(positions[id].offset);
                } else {
                    setScale(1);
                    setOffset({ x: 0, y: 0 });
                }
            } catch (e) {
                setScale(1);
                setOffset({ x: 0, y: 0 });
            }
        } catch (e) {
            console.error("Roadmap load failed", e);
            setNodes([]);
            setConnections([]);
        }
    };

    const createNewRoadmap = () => {
        setCreateRoadmapTitle("");
        setShowCreateModal(true);
    };

    const confirmCreateRoadmap = async () => {
        const title = createRoadmapTitle.trim() || "New Roadmap";
        const id = generateId();
        const newRoadmap = {
            id,
            title,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            nodeCount: 0
        };

        // Create initial file immediately so loadRoadmap doesn't fail
        try {
            await fs.mkdir(DB_PATH, { recursive: true });
            await fs.writeFile(getRoadmapFile(id), JSON.stringify({ nodes: [], connections: [] }, null, 2));
        } catch (e) {
            console.error("Failed to create initial roadmap file", e);
        }

        const newList = [newRoadmap, ...roadmapsList];
        setRoadmapsList(newList);
        await saveIndex(newList);
        setActiveRoadmapId(id);
        setNodes([]);
        setConnections([]);
        setShowCreateModal(false);
    };

    const deleteRoadmap = async (e, id) => {
        e.stopPropagation();
        const newList = roadmapsList.filter(r => r.id !== id);
        setRoadmapsList(newList);
        await saveIndex(newList);
        try { await fs.unlink(getRoadmapFile(id)); } catch (e) { }
    };

    const renameRoadmap = async (id, newTitle) => {
        const newList = roadmapsList.map(r => r.id === id ? { ...r, title: newTitle } : r);
        setRoadmapsList(newList);
        await saveIndex(newList);
    };

    useEffect(() => {
        loadIndex();
        if (location.state?.exitedToHub) {
            setActiveRoadmapId(null);
        } else if (location.state?.roadmapId) {
            setActiveRoadmapId(location.state.roadmapId);
        }
    }, [location.state?.roadmapId, location.state?.exitedToHub]);

    useEffect(() => {
        if (activeRoadmapId) {
            localStorage.setItem('last_opened_roadmap', activeRoadmapId);
        } else {
            localStorage.removeItem('last_opened_roadmap');
        }
    }, [activeRoadmapId]);

    useEffect(() => {
        // If we have goal context but it doesn't match the current roadmap, clear it
        if (location.state?.fromGoal && activeRoadmapId && activeRoadmapId !== location.state?.roadmapId) {
            navigate('/Growth/roadmap', { replace: true, state: {} });
        }
    }, [activeRoadmapId, location.state, navigate]);

    useEffect(() => {
        if (activeRoadmapId) {
            loadRoadmap(activeRoadmapId);
        } else {
            setNodes([]);
            setConnections([]);
            setScale(1);
            setOffset({ x: 0, y: 0 });
            loadIndex();
        }
    }, [activeRoadmapId]);

    useEffect(() => {
        if (!activeRoadmapId) return;
        const persistPosition = () => {
            try {
                const positions = JSON.parse(localStorage.getItem('roadmap_positions') || '{}');
                positions[activeRoadmapId] = { scale, offset };
                localStorage.setItem('roadmap_positions', JSON.stringify(positions));
            } catch (e) {
                console.error("Failed to save roadmap position", e);
            }
        };

        const timeoutId = setTimeout(persistPosition, 300);
        return () => clearTimeout(timeoutId);
    }, [scale, offset, activeRoadmapId]);

    const saveData = async (newNodes, newConnections) => {
        if (!activeRoadmapId) return;
        try {
            await fs.mkdir(DB_PATH, { recursive: true });
            await fs.writeFile(getRoadmapFile(activeRoadmapId), JSON.stringify({ nodes: newNodes, connections: newConnections }, null, 2));

            // Update index with node count and timestamp using functional update to avoid stale closures
            setRoadmapsList(prevList => {
                const updatedList = prevList.map(r =>
                    r.id === activeRoadmapId
                        ? { ...r, lastModified: new Date().toISOString(), nodeCount: newNodes.length }
                        : r
                );
                saveIndex(updatedList);
                return updatedList;
            });
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    // --- ACTIONS ---
    // --- ACTIONS ---
    const addNode = useCallback((type = 'card') => {
        const container = containerRef.current;
        if (!container) return;

        pushToHistory(nodes, connections);

        const centerX = (-offset.x + container.clientWidth / 2) / scale;
        const centerY = (-offset.y + container.clientHeight / 2) / scale;

        const newNode = {
            id: generateId(),
            x: centerX - 120,
            y: centerY - 80,
            title: type === 'section' ? 'New Section' : (type === 'text-note' ? 'New Note' : (type === 'todo-list' ? 'Todo List' : 'New Card')),
            content: '',
            width: type === 'section' ? 400 : (type === 'text-note' ? 120 : 240),
            color: 'blue',
            height: type === 'section' ? 300 : (type === 'text-note' ? 30 : (type === 'todo-list' ? 150 : 50)),
            type: type,
            tasks: type === 'todo-list' ? [] : undefined
        };

        setNodes(prev => {
            const updated = [...prev, newNode];
            saveData(updated, connections);
            return updated;
        });
    }, [offset, scale, connections, nodes, pushToHistory]);

    const bringToFront = useCallback((ids) => {
        setNodes(prev => {
            const idList = Array.isArray(ids) ? ids : [ids];
            const targets = prev.filter(n => idList.includes(n.id));
            const others = prev.filter(n => !idList.includes(n.id));
            return [...others, ...targets];
        });
    }, []);

    const updateNode = useCallback((id, updates) => {
        setNodes(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, ...updates } : n);
            saveData(updated, connections);
            return updated;
        });
        bringToFront(id);
    }, [connections, bringToFront]);

    const spawnNodeInDirection = useCallback((direction) => {
        const sourceNode = nodes.find(n => n.id === selectedNodeIds[0]);
        if (!sourceNode) return;

        pushToHistory(nodes, connections);
        const gap = 40;
        const newWidth = 240;
        const newHeight = 50;
        let newX = sourceNode.x;
        let newY = sourceNode.y;
        let fromH = 'right';
        let toH = 'left';

        const sourceWidth = sourceNode.width || 240;
        const sourceHeight = sourceNode.height || 50;

        switch (direction) {
            case 'right':
                newX = sourceNode.x + sourceWidth + gap;
                newY = sourceNode.y + (sourceHeight / 2) - (newHeight / 2);
                fromH = 'right';
                toH = 'left';
                break;
            case 'left':
                newX = sourceNode.x - newWidth - gap;
                newY = sourceNode.y + (sourceHeight / 2) - (newHeight / 2);
                fromH = 'left';
                toH = 'right';
                break;
            case 'down':
                newX = sourceNode.x + (sourceWidth / 2) - (newWidth / 2);
                newY = sourceNode.y + sourceHeight + gap;
                fromH = 'bottom';
                toH = 'top';
                break;
            case 'up':
                newX = sourceNode.x + (sourceWidth / 2) - (newWidth / 2);
                newY = sourceNode.y - newHeight - gap;
                fromH = 'top';
                toH = 'bottom';
                break;
        }

        const newNode = {
            id: generateId(),
            x: newX,
            y: newY,
            title: 'New Card',
            content: '',
            width: newWidth,
            height: newHeight,
            color: sourceNode.color || 'blue',
            type: 'card'
        };

        const newConnection = {
            id: generateId(),
            from: sourceNode.id,
            to: newNode.id,
            fromHandle: fromH,
            toHandle: toH
        };

        setNodes(prev => {
            const updated = [...prev, newNode];
            saveData(updated, [...connections, newConnection]);
            return updated;
        });
        setConnections(prev => [...prev, newConnection]);
        setSelectedNodeIds([newNode.id]);
        setSidebarOpenNodeId(newNode.id);
    }, [nodes, connections, pushToHistory]);

    const updateNodes = useCallback((ids, updates) => {
        pushToHistory(nodes, connections);
        setNodes(prev => {
            const updated = prev.map(n => ids.includes(n.id) ? { ...n, ...updates } : n);
            saveData(updated, connections);
            return updated;
        });
        bringToFront(ids);
    }, [nodes, connections, pushToHistory, bringToFront]);

    const deleteNode = useCallback((id) => {
        pushToHistory(nodes, connections);
        setNodes(prev => {
            const updatedNodes = prev.filter(n => n.id !== id);
            // We also need to filter connections.
            // This is tricky with functional updates for two states.
            // We'll trust the outer scope 'connections' is reasonably fresh or update via setConnections callback.
            // Actually, best to update both.

            setConnections(prevConns => {
                const updatedConn = prevConns.filter(c => c.from !== id && c.to !== id);
                saveData(updatedNodes, updatedConn);
                return updatedConn;
            });

            if (sidebarOpenNodeId === id) setSidebarOpenNodeId(null);

            return updatedNodes;
        });
    }, [nodes, connections, pushToHistory, sidebarOpenNodeId]);


    const clearCanvas = () => {
        setShowClearModal(true);
    }

    const confirmClear = useCallback(() => {
        pushToHistory(nodes, connections);
        setNodes([]);
        setConnections([]);
        saveData([], []);
        setShowClearModal(false);
    }, [nodes, connections, pushToHistory]);

    // --- SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Context-aware shortcuts
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

            // Allow 'Delete' key and Undo/Redo to work even in input
            const isUndoRedo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z');
            const isForceDeleteKey = e.key === 'Delete';
            if (isInput && !isForceDeleteKey && !isUndoRedo) return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' || e.key === 'C') {
                    // COPY
                    if (selectedNodeIds.length > 0) {
                        const nodesToCopy = nodesRef.current.filter(n => selectedNodeIds.includes(n.id));
                        const connectionsToCopy = connections.filter(c =>
                            selectedNodeIds.includes(c.from) && selectedNodeIds.includes(c.to)
                        );
                        setClipboard({ nodes: nodesToCopy, connections: connectionsToCopy });
                    }
                } else if (e.key === 'z' || e.key === 'Z') {
                    e.preventDefault();
                    if (e.altKey) {
                        redo();
                    } else {
                        undo();
                    }
                } else if (e.key === 'v' || e.key === 'V') {
                    // PASTE
                    const { nodes: cbNodes, connections: cbConns } = clipboardRef.current;
                    if (cbNodes && cbNodes.length > 0) {
                        pushToHistory(nodesRef.current, connections);
                        const idMap = {};
                        const minX = Math.min(...cbNodes.map(n => n.x));
                        const minY = Math.min(...cbNodes.map(n => n.y));
                        const currentMouse = mousePosRef.current;

                        const newNodes = cbNodes.map((baseNode, idx) => {
                            const newId = (Date.now() + idx).toString() + Math.random().toString(36).substr(2, 5);
                            idMap[baseNode.id] = newId;

                            // Calculate relative position from group's top-left
                            const relX = baseNode.x - minX;
                            const relY = baseNode.y - minY;

                            return {
                                ...baseNode,
                                id: newId,
                                x: currentMouse.x + relX,
                                y: currentMouse.y + relY
                            };
                        });

                        const newConns = (cbConns || []).map(c => ({
                            ...c,
                            id: generateId(),
                            from: idMap[c.from],
                            to: idMap[c.to]
                        }));

                        setNodes(prev => {
                            const updatedNodes = [...prev, ...newNodes];
                            setConnections(prevConns => {
                                const updatedConns = [...prevConns, ...newConns];
                                saveData(updatedNodes, updatedConns);
                                return updatedConns;
                            });
                            return updatedNodes;
                        });
                        setSelectedNodeIds(newNodes.map(n => n.id));
                    }
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    // DELETE 
                    if (selectedNodeIds.length > 0) {
                        pushToHistory(nodesRef.current, connections);
                        const idsToDelete = [...selectedNodeIds];
                        const remainingNodes = nodesRef.current.filter(n => !idsToDelete.includes(n.id));
                        const remainingConnections = connections.filter(c =>
                            !idsToDelete.includes(c.from) && !idsToDelete.includes(c.to)
                        );
                        setNodes(remainingNodes);
                        setConnections(remainingConnections);
                        saveData(remainingNodes, remainingConnections);
                        setSelectedNodeIds([]);
                        setSidebarOpenNodeId(null);
                        e.preventDefault();
                    }
                }
            } else if (e.key === 'Delete') {
                if (selectedNodeIds.length > 0) {
                    selectedNodeIds.forEach(id => deleteNode(id));
                    setSelectedNodeIds([]);
                    setSidebarOpenNodeId(null);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeIds, connections, deleteNode, nodesRef, clipboardRef, setClipboard, saveData, setNodes, setSelectedNodeIds]);

    // --- EVENTS ---
    const handleMouseDown = (e) => {
        // Cache layout
        if (containerRef.current) {
            layoutCacheRef.current = containerRef.current.getBoundingClientRect();
        }

        const containerRect = layoutCacheRef.current;
        const currentScale = scaleRef.current;
        const currentOffset = offsetRef.current;

        // Canvas coordinates
        const canvasX = (e.clientX - containerRect.left - currentOffset.x) / currentScale;
        const canvasY = (e.clientY - containerRect.top - currentOffset.y) / currentScale;

        // Right-click Selection Box
        if (e.button === 2) {
            setSelectionBox({
                startX: canvasX,
                startY: canvasY,
                currentX: canvasX,
                currentY: canvasY
            });
            return;
        }

        // Pan if: Middle click (1), Ctrl+Left (0), or Left click on background
        const isBackground = e.target === containerRef.current || (containerRef.current && containerRef.current.contains(e.target) && !e.target.closest('.pointer-events-auto'));

        if (e.button === 1 || (e.ctrlKey && e.button === 0) || (e.button === 0 && isBackground)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            // Only deselect if actually clicking empty space
            if (isBackground && !e.ctrlKey && !e.shiftKey) {
                setSelectedNodeIds([]);
                setSidebarOpenNodeId(null);
            }
        }
    };

    const handleNodeMouseDown = useCallback((e, id) => {
        if (e.ctrlKey) return;
        e.stopPropagation();
        if (e.button !== 0) return;

        // Log snapshot before movement starts
        moveStartSnapshotRef.current = { nodes: [...nodesRef.current], connections: [...connections] };

        if (containerRef.current) {
            layoutCacheRef.current = containerRef.current.getBoundingClientRect();
        }

        const node = nodesRef.current.find(n => n.id === id);
        if (!node) return;

        // Multi-drag logic: if node is already selected, drag all selected nodes
        let dragNodes = [];
        if (selectedNodeIds.includes(id)) {
            dragNodes = selectedNodeIds;
        } else {
            setSelectedNodeIds([id]);
            dragNodes = [id];
        }

        bringToFront(dragNodes);

        const containerRect = layoutCacheRef.current;
        const currentScale = scaleRef.current;
        const currentOffset = offsetRef.current;

        // Calculate click position in canvas space
        const canvasX = (e.clientX - containerRect.left - currentOffset.x) / currentScale;
        const canvasY = (e.clientY - containerRect.top - currentOffset.y) / currentScale;

        setIsDraggingNode(id);
        const offsets = {};
        dragNodes.forEach(nid => {
            const n = nodesRef.current.find(node => node.id === nid);
            if (n) {
                offsets[nid] = {
                    offsetX: canvasX - n.x,
                    offsetY: canvasY - n.y
                };
            }
        });

        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            multiOffsets: offsets
        };
        hasDraggedRef.current = false;
        setSidebarOpenNodeId(null);
    }, [selectedNodeIds]);

    const handleHandleMouseDown = useCallback((e, nodeId, handleType) => {
        if (e.ctrlKey) return;
        e.stopPropagation();
        const rect = e.target.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const startX = (rect.left + rect.width / 2 - containerRect.left - offset.x) / scale;
        const startY = (rect.top + rect.height / 2 - containerRect.top - offset.y) / scale;

        bringToFront(nodeId);
        setConnectionStart({ nodeId, handle: handleType, x: startX, y: startY });
    }, [offset, scale, containerRef, setConnectionStart]);

    const handleResizeMouseDown = useCallback((e, nodeId, handleType) => {
        e.stopPropagation();
        const node = nodesRef.current.find(n => n.id === nodeId);
        if (!node) return;

        if (containerRef.current) {
            layoutCacheRef.current = containerRef.current.getBoundingClientRect();
        }

        const containerRect = layoutCacheRef.current;
        const startX = (e.clientX - containerRect.left - offset.x) / scale;
        const startY = (e.clientY - containerRect.top - offset.y) / scale;

        bringToFront(nodeId);
        setResizingState({
            nodeId,
            handleType,
            startX,
            startY,
            initialX: node.x,
            initialY: node.y,
            initialWidth: node.width || 240,
            initialHeight: node.height || 50
        });
    }, [offset, scale, nodesRef, containerRef, layoutCacheRef, setResizingState]);

    const handleMouseMove = (e) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 16) return;
        lastUpdateRef.current = now;

        const container = containerRef.current;
        if (!container) return;

        // Use cached rect if available, else get it (fallback)
        const containerRect = layoutCacheRef.current || container.getBoundingClientRect();
        const canvasX = (e.clientX - containerRect.left - offset.x) / scale;
        const canvasY = (e.clientY - containerRect.top - offset.y) / scale;

        setMousePos({ x: canvasX, y: canvasY });
        mousePosRef.current = { x: canvasX, y: canvasY };

        if (selectionBox) {
            setSelectionBox(prev => ({
                ...prev,
                currentX: canvasX,
                currentY: canvasY
            }));
            return;
        }

        if (resizingState) {
            const { nodeId, handleType, startX, startY, initialX, initialY, initialWidth, initialHeight } = resizingState;
            const dx = canvasX - startX;
            const dy = canvasY - startY;

            let newX = initialX;
            let newY = initialY;
            let newW = initialWidth;
            let newH = initialHeight;

            if (handleType.includes('e')) {
                newW = Math.max(50, initialWidth + dx);
            }
            if (handleType.includes('w')) {
                const intendedW = initialWidth - dx;
                newW = Math.max(50, intendedW);
                newX = initialX + (initialWidth - newW);
            }
            if (handleType.includes('s')) {
                newH = Math.max(50, initialHeight + dy);
            }
            if (handleType.includes('n')) {
                const intendedH = initialHeight - dy;
                newH = Math.max(50, intendedH);
                newY = initialY + (initialHeight - newH);
            }

            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: newX, y: newY, width: newW, height: newH } : n));
            return;
        }

        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setOffset({ x: offset.x + dx, y: offset.y + dy });
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (isDraggingNode) {
            if (!hasDraggedRef.current) {
                const dist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
                if (dist > 5) {
                    hasDraggedRef.current = true;
                }
            }

            if (hasDraggedRef.current) {
                const { multiOffsets } = dragStartRef.current;

                let targetY = canvasY - (multiOffsets[isDraggingNode]?.offsetY || 0);
                let targetX = canvasX - (multiOffsets[isDraggingNode]?.offsetX || 0);

                // --- SNAPPING LOGIC ---
                let activeSnapY = null;
                let activeSnapX = null;
                if (snapEnabled) {
                    const threshold = 10;
                    const otherNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id));

                    // 1. Horizontal Snapping (Existing)
                    for (const other of otherNodes) {
                        if (Math.abs(targetY - other.y) < threshold) {
                            targetY = other.y;
                            activeSnapY = other.y;
                            break;
                        }
                    }

                    // 2. Special Vertical Alignment Snapping (Straight Lines)
                    // Only snap X if we are dragging a single node or if we want to align the primary dragged node
                    const draggingNode = nodesRef.current.find(n => n.id === isDraggingNode);
                    if (draggingNode) {
                        const connectionsToNode = connections.filter(c => c.from === isDraggingNode || c.to === isDraggingNode);
                        for (const conn of connectionsToNode) {
                            const isFrom = conn.from === isDraggingNode;
                            const otherId = isFrom ? conn.to : conn.from;
                            const otherNode = nodesRef.current.find(n => n.id === otherId);

                            if (otherNode && !selectedNodeIds.includes(otherId)) {
                                const myHandle = isFrom ? (conn.fromHandle || 'right') : (conn.toHandle || 'left');
                                const otherHandle = isFrom ? (conn.toHandle || 'left') : (conn.fromHandle || 'right');

                                // Check for Bottom-Top relationship
                                if ((myHandle === 'top' && otherHandle === 'bottom') || (myHandle === 'bottom' && otherHandle === 'top')) {
                                    const otherCenterX = otherNode.x + (otherNode.width || 240) / 2;
                                    const myCenterX = targetX + (draggingNode.width || 240) / 2;

                                    if (Math.abs(myCenterX - otherCenterX) < threshold) {
                                        targetX = otherCenterX - (draggingNode.width || 240) / 2;
                                        activeSnapX = otherCenterX;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                setSnapGuide(activeSnapY !== null ? { y: activeSnapY } : (activeSnapX !== null ? { x: activeSnapX } : null));
                // ----------------------

                setNodes(prev => prev.map(n => {
                    if (multiOffsets && multiOffsets[n.id]) {
                        const { offsetX, offsetY } = multiOffsets[n.id];
                        // If it's the primary node being dragged, use the (potentially snapped) targetY
                        // For multi-drag, we apply the same delta to all.
                        if (n.id === isDraggingNode) {
                            return { ...n, x: targetX, y: targetY };
                        } else {
                            // Calculate delta relative to the primary dragged node
                            const dx = targetX - (canvasX - multiOffsets[isDraggingNode].offsetX);
                            const dy = targetY - (canvasY - multiOffsets[isDraggingNode].offsetY);
                            return { ...n, x: (canvasX - offsetX) + dx, y: (canvasY - offsetY) + dy };
                        }
                    }
                    return n;
                }));
            }
        }

        if (connectionStart) {
            const hitNode = nodes.find(n =>
                n.id !== connectionStart.nodeId &&
                canvasX > n.x - 20 && canvasX < n.x + (n.width || 240) + 20 &&
                canvasY > n.y - 20 && canvasY < n.y + (n.height || 50) + 70
            );
            setPotentialTargetId(hitNode ? hitNode.id : null);
        }
    };

    const handleMouseUp = (e) => {
        if (selectionBox) {
            // Find nodes within selection box
            const { startX, startY, currentX, currentY } = selectionBox;
            const x1 = Math.min(startX, currentX);
            const x2 = Math.max(startX, currentX);
            const y1 = Math.min(startY, currentY);
            const y2 = Math.max(startY, currentY);

            const selected = nodesRef.current.filter(n => {
                const nx1 = n.x;
                const nx2 = n.x + (n.width || 240);
                const ny1 = n.y;
                const ny2 = n.y + (n.height || 50);

                // Check if node is at least partially within box
                return nx2 > x1 && nx1 < x2 && ny2 > y1 && ny1 < y2;
            });

            setSelectedNodeIds(selected.map(n => n.id));
            setSidebarOpenNodeId(null);
            setSelectionBox(null);
            return;
        }

        if (resizingState) {
            saveData(nodes, connections);
            setResizingState(null);
            return;
        }

        if (isDraggingNode) {
            // If dragging happened, save and log to history
            if (hasDraggedRef.current) {
                if (moveStartSnapshotRef.current) {
                    pushToHistory(moveStartSnapshotRef.current.nodes, moveStartSnapshotRef.current.connections);
                    moveStartSnapshotRef.current = null;
                }
                saveData(nodes, connections);
                setSidebarOpenNodeId(null);
            } else {
                if (e.ctrlKey) {
                    const isAlreadySelected = selectedNodeIds.includes(isDraggingNode);
                    if (isAlreadySelected) {
                        setSelectedNodeIds(prev => prev.filter(iid => iid !== isDraggingNode));
                        setSidebarOpenNodeId(null);
                    } else {
                        setSelectedNodeIds(prev => [...prev, isDraggingNode]);
                        setSidebarOpenNodeId(isDraggingNode);
                    }
                } else {
                    setSelectedNodeIds([isDraggingNode]);
                    setSidebarOpenNodeId(isDraggingNode);
                }
            }
            setIsDraggingNode(null);
            hasDraggedRef.current = false;
        }
        setIsPanning(false);

        if (connectionStart) {
            // Check if dropped on a node handle
            // Simple hit testing - typically we'd look for an element under the cursor
            // But dragging stops events. 
            // We can just rely on the React tree if we pass event up, but here we are on window/container.

            // Actually, simpler: we only end dragging. Connecting happens if we land on a valid target.
            // Since we didn't implement 'drop on target' logic in the target component, let's add logic:

            // Use the calculated canvas pos from handleMouseMove state would be stale, recalculate:
            const containerRect = containerRef.current.getBoundingClientRect();
            const canvasX = (e.clientX - containerRect.left - offset.x) / scale;
            const canvasY = (e.clientY - containerRect.top - offset.y) / scale;


            const hitNode = nodes.find(n =>
                n.id !== connectionStart.nodeId &&
                canvasX > n.x - 20 && canvasX < n.x + (n.width || 240) + 20 &&
                canvasY > n.y - 20 && canvasY < n.y + (n.height || 50) + 70 // even more generous hit detection
            );

            if (hitNode) {
                const nodeW = hitNode.width || 240;
                const nodeH = hitNode.height || 50;

                const targetHandles = {
                    left: { x: hitNode.x, y: hitNode.y + nodeH / 2 },
                    right: { x: hitNode.x + nodeW, y: hitNode.y + nodeH / 2 },
                    top: { x: hitNode.x + nodeW / 2, y: hitNode.y },
                    bottom: { x: hitNode.x + nodeW / 2, y: hitNode.y + nodeH }
                };

                let bestHandle = 'left';
                let minDist = Infinity;

                Object.entries(targetHandles).forEach(([key, pos]) => {
                    const dist = Math.hypot(canvasX - pos.x, canvasY - pos.y);
                    if (dist < minDist) {
                        minDist = dist;
                        bestHandle = key;
                    }
                });

                // Create connection
                const newConn = {
                    id: generateId(),
                    from: connectionStart.nodeId,
                    to: hitNode.id,
                    fromHandle: connectionStart.handle,
                    toHandle: bestHandle
                };

                // Allow multiple connections unless identical
                if (!connections.find(c =>
                    c.from === newConn.from &&
                    c.to === newConn.to &&
                    c.fromHandle === newConn.fromHandle &&
                    c.toHandle === newConn.toHandle
                )) {
                    pushToHistory(nodes, connections);
                    const updated = [...connections, newConn];
                    setConnections(updated);
                    saveData(nodes, updated);
                }
            }

            setPotentialTargetId(null);
            setConnectionStart(null);
        }
        setSnapGuide(null);
    };

    // --- RENDER HELPERS ---
    const getHandleCoords = (nodeId, handleType) => {
        const node = nodeMap.get(nodeId);
        if (!node) return { x: 0, y: 0 };

        const width = node.width || 240;
        const height = node.height || 50;

        switch (handleType) {
            case 'top': return { x: node.x + width / 2, y: node.y };
            case 'bottom': return { x: node.x + width / 2, y: node.y + height };
            case 'left': return { x: node.x, y: node.y + height / 2 };
            case 'right': return { x: node.x + width, y: node.y + height / 2 };
            default: return { x: node.x + width, y: node.y + height / 2 }; // fallback
        }
    };

    const deleteConnection = useCallback((id) => {
        pushToHistory(nodes, connections);
        setConnections(prev => {
            const updated = prev.filter(c => c.id !== id);
            // Note: should generally save with current nodes
            saveData(nodesRef.current, updated);
            return updated;
        });
    }, []);

    const handleWheel = (e) => {
        if (!activeRoadmapId) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const zoomSpeed = 0.0002;
        const delta = -e.deltaY * zoomSpeed;
        const newScale = Math.min(Math.max(scale + delta, 0.1), 4);

        if (newScale !== scale) {
            const mouseX = e.clientX - containerRect.left;
            const mouseY = e.clientY - containerRect.top;

            // Point on canvas under the mouse before zooming
            const canvasX = (mouseX - offset.x) / scale;
            const canvasY = (mouseY - offset.y) / scale;

            // New offset to keep the same canvas point under the mouse after zooming
            const newOffsetX = mouseX - canvasX * newScale;
            const newOffsetY = mouseY - canvasY * newScale;

            setScale(newScale);
            setOffset({ x: newOffsetX, y: newOffsetY });
        }
    };

    const renderModals = () => (
        <>
            {/* --- CONFIRMATION MODAL --- */}
            {showClearModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
                            <LocalIcon src={trashIcon} size={24} className="filter-none invert-[35%] sepia-[100%] saturate-[1000%] hue-rotate-[-10deg]" />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2 tracking-tight">Clear Workspace?</h3>
                        <p className="text-zinc-400 text-sm text-center mb-8">This will permanently delete all nodes and connections. This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmClear}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all cursor-pointer"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- CREATE MODAL --- */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300 space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white tracking-tight text-center">New Roadmap</h3>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-[0.2em]">Strategy Title</p>
                        </div>

                        <input
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-bold"
                            placeholder="Enter strategy name..."
                            value={createRoadmapTitle}
                            onChange={(e) => setCreateRoadmapTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmCreateRoadmap()}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCreateRoadmap}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // --- DASHBOARD RENDER ---
    if (!activeRoadmapId) {
        return (
            <div
                className="fixed inset-0 bg-black overflow-y-auto custom-scrollbar p-6 md:p-8"
                style={{ marginLeft: '24px' }}
            >
                <div className="max-w-[1200px] mx-auto space-y-4 pb-32">
                    <header className="flex justify-between items-center border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <LocalIcon src={chartIcon} size={16} className="text-blue-500" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white tracking-widest uppercase">Roadmaps</h1>
                                <p className="text-zinc-600 text-[8px] font-mono uppercase tracking-[0.2em]">Strategy Repository v1.0</p>
                            </div>
                        </div>
                        <button
                            onClick={createNewRoadmap}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-bold text-[9px] uppercase tracking-widest hover:bg-zinc-200 transition-all cursor-pointer active:scale-95"
                        >
                            <LocalIcon src={plusIcon} size={12} className="brightness-0 invert-0" />
                            New Strategy
                        </button>
                    </header>

                    <div className="flex flex-col gap-1.5">
                        {/* Roadmap List Items */}
                        {roadmapsList.map((roadmap) => (
                            <div
                                key={roadmap.id}
                                onClick={() => {
                                    setActiveRoadmapId(roadmap.id);
                                    navigate('/Growth/roadmap', { replace: true, state: {} });
                                }}
                                className="group relative flex items-center gap-6 px-4 py-2.5 rounded-lg border border-white/[0.03] bg-zinc-900/10 hover:bg-zinc-900/30 hover:border-white/10 transition-all duration-200 cursor-pointer backdrop-blur-sm"
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                                    <LocalIcon src={zapIcon} size={14} className="opacity-20 group-hover:opacity-100 text-blue-500" />
                                </div>

                                <input
                                    className="flex-1 text-xs font-bold text-white/80 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-1 -ml-1 truncate"
                                    value={roadmap.title}
                                    placeholder="Untitled Strategy"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => renameRoadmap(roadmap.id, e.target.value)}
                                />

                                <div className="flex items-center gap-12 text-[9px] font-mono uppercase tracking-widest">
                                    <div className="flex flex-col items-end w-24">
                                        <span className="text-zinc-600">Complexity</span>
                                        <span className="text-zinc-400">{roadmap.nodeCount || 0} Nodes</span>
                                    </div>
                                    <div className="flex flex-col items-end w-32 hidden md:flex">
                                        <span className="text-zinc-600">Created</span>
                                        <span className="text-zinc-400">{new Date(roadmap.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pl-4 border-l border-white/5">
                                    <button
                                        onClick={(e) => deleteRoadmap(e, roadmap.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                    >
                                        <LocalIcon src={trashIcon} size={12} className="opacity-40 hover:opacity-100" />
                                    </button>
                                    <div className="w-6 h-6 flex items-center justify-center text-zinc-700 group-hover:text-white transition-all transform group-hover:translate-x-1">
                                        <LocalIcon src={rightIcon} size={12} />
                                    </div>
                                </div>

                                {/* Active Accent */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 bg-blue-500 group-hover:h-1/2 transition-all duration-300 rounded-full"></div>
                            </div>
                        ))}

                        {roadmapsList.length === 0 && (
                            <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                                <p className="text-zinc-600 text-[10px] uppercase font-mono tracking-widest">No active strategies detected in repository</p>
                                <button onClick={createNewRoadmap} className="mt-4 text-blue-500 text-[9px] uppercase font-bold hover:underline cursor-pointer">Initialize First Strategy</button>
                            </div>
                        )}
                    </div>
                </div>
                {renderModals()}
            </div>
        );
    }

    return (
        <div
            className="w-full h-full bg-black fixed inset-0 overflow-hidden font-sans z-0 select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* --- BACKGROUND GRID --- */}
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-40"
                style={{
                    backgroundSize: `${40 * scale}px ${40 * scale}px`,
                    backgroundPosition: `${offset.x}px ${offset.y}px`,
                    backgroundImage: `radial-gradient(circle, #444 1px, transparent 1px)`
                }}
            />

            {/* --- CONTROLS UI --- */}
            <div className="absolute bottom-16 left-[calc(50%+24px)] -translate-x-1/2 z-[60] flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl scale-90 origin-bottom">
                <button onClick={() => addNode('card')} className="w-11 h-11 flex items-center justify-center bg-white text-black hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer active:scale-95 group relative">
                    <LocalIcon src={plusIcon} size={18} className="brightness-0 invert-0" />
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Add Card</span>
                </button>
                <button onClick={() => addNode('sub-card')} className="w-11 h-11 flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer active:scale-95 group relative border border-dashed border-white/20">
                    <LocalIcon src={plusIcon} size={18} opacity="opacity-50" />
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Add Sub Card</span>
                </button>
                <button onClick={() => addNode('section')} className="w-11 h-11 flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer active:scale-95 group relative border-2 border-white/20">
                    <LocalIcon src={chartIcon} size={18} opacity="opacity-50" />
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Add Section</span>
                </button>
                <button onClick={() => addNode('text-note')} className="w-11 h-11 flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer active:scale-95 group relative border border-white/5">
                    <span className="font-mono text-xs font-bold">Aa</span>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Add Text Note</span>
                </button>
                <button onClick={() => addNode('todo-list')} className="w-11 h-11 flex items-center justify-center bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer active:scale-95 group relative border border-white/5">
                    <LocalIcon src={checkIcon} size={18} opacity="opacity-50" />
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Add Todo List</span>
                </button>

                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button onClick={() => { setOffset({ x: 0, y: 0 }); setScale(1); }} className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Reset View">
                    <LocalIcon src={rotateIcon} size={18} opacity="opacity-40" />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button onClick={clearCanvas} className="w-11 h-11 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer" title="Clear All">
                    <LocalIcon src={trashIcon} size={18} className="filter-none invert-[35%] sepia-[100%] saturate-[1000%] hue-rotate-[-10deg]" />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button
                    onClick={() => setSnapEnabled(!snapEnabled)}
                    className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors cursor-pointer active:scale-95 group relative border border-white/5 ${snapEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'}`}
                    title={snapEnabled ? "Disable Snapping" : "Enable Snapping"}
                >
                    <LocalIcon src={zapIcon} size={18} opacity={snapEnabled ? "opacity-100" : "opacity-40"} />
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                        {snapEnabled ? "Snapping ON" : "Snapping OFF"}
                    </span>
                </button>
            </div>

            {/* --- BATCH EDIT TOOLBAR --- */}
            {selectedNodeIds.length > 1 && (
                <div className="absolute bottom-32 left-[calc(50%+24px)] -translate-x-1/2 z-[61] flex items-center gap-1.5 p-1.5 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl scale-90 origin-bottom">
                    <div className="flex items-center px-2 border-r border-white/10 h-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{selectedNodeIds.length} Nodes</span>
                    </div>

                    {/* COLORS */}
                    <div className="flex gap-1 px-1">
                        {Object.entries(COLORS).map(([key, theme]) => (
                            <button
                                key={key}
                                onClick={() => updateNodes(selectedNodeIds, { color: key })}
                                className={`w-6 h-6 rounded-md transition-all ${theme.border} ${theme.bg} opacity-70 hover:opacity-100 hover:scale-110 flex items-center justify-center cursor-pointer`}
                                title={key}
                            >
                            </button>
                        ))}
                    </div>

                    <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                    {/* TYPOGRAPHY */}
                    <div className="flex gap-1 px-1">
                        <button
                            onClick={() => updateNodes(selectedNodeIds, { fontWeight: 'bold' })}
                            className="px-2 py-1.5 rounded-md hover:bg-white/10 text-[10px] font-bold text-zinc-400 hover:text-white transition-all uppercase cursor-pointer"
                        >
                            Bold
                        </button>
                        <button
                            onClick={() => updateNodes(selectedNodeIds, { fontStyle: 'italic' })}
                            className="px-2 py-1.5 rounded-md hover:bg-white/10 text-[10px] italic text-zinc-400 hover:text-white transition-all uppercase font-bold cursor-pointer"
                        >
                            Italic
                        </button>
                        <button
                            onClick={() => updateNodes(selectedNodeIds, { fontWeight: 'normal', fontStyle: 'normal' })}
                            className="px-2 py-1.5 rounded-md hover:bg-white/10 text-[10px] text-zinc-400 hover:text-white transition-all uppercase font-bold cursor-pointer"
                        >
                            Reset
                        </button>
                    </div>

                    <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                    {/* SIZES */}
                    <div className="flex gap-0.5 px-1">
                        {Object.keys(SIZE_MAP).map(sz => (
                            <button
                                key={sz}
                                onClick={() => updateNodes(selectedNodeIds, { fontSize: sz })}
                                className="w-7 py-1.5 rounded-md hover:bg-white/10 text-[9px] font-bold text-zinc-400 hover:text-white transition-all uppercase cursor-pointer"
                            >
                                {sz}
                            </button>
                        ))}
                    </div>

                    <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                    <button onClick={() => setSelectedNodeIds([])} className="p-1 px-2 text-zinc-500 hover:text-white transition-colors cursor-pointer">
                        <LocalIcon src={closeIcon} size={14} opacity="opacity-50" />
                    </button>
                </div>
            )}

            {/* --- EMPTY STATE HINT --- */}
            {
                nodes.length === 0 && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-50 z-20">
                        <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-2">Infinite Workflow Canvas</p>
                        <p className="text-zinc-600 text-[10px]">Use the controls below to build schematic</p>
                    </div>
                )
            }

            {/* --- CANVAS --- */}
            <div
                ref={containerRef}
                className={`w-full h-full transition-colors duration-300 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                onContextMenu={(e) => {
                    if (selectionBox) e.preventDefault();
                    // Optional: always prevent if you want custom context menu later
                    e.preventDefault();
                }}
            >
                <div
                    className="w-full h-full transform-gpu origin-top-left"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
                    }}
                >
                    {/* CONNECTIONS LAYER */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g>
                            {connections.map(conn => {
                                const start = getHandleCoords(conn.from, conn.fromHandle || 'right');
                                const end = getHandleCoords(conn.to, conn.toHandle || 'left');
                                const fromNode = nodeMap.get(conn.from);
                                const toNode = nodeMap.get(conn.to);

                                return (
                                    <Connection
                                        key={conn.id}
                                        conn={conn}
                                        start={start}
                                        end={end}
                                        fromNode={fromNode}
                                        toNode={toNode}
                                        onDelete={deleteConnection}
                                    />
                                );
                            })}
                        </g>                            {connectionStart && (
                            <path
                                d={`M ${connectionStart.x} ${connectionStart.y} L ${mousePos.x} ${mousePos.y}`}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                fill="none"
                                className="opacity-60"
                            />
                        )}

                        {snapGuide && (
                            <line
                                x1={snapGuide.x !== undefined ? snapGuide.x : -5000}
                                y1={snapGuide.y !== undefined ? snapGuide.y : -5000}
                                x2={snapGuide.x !== undefined ? snapGuide.x : 5000}
                                y2={snapGuide.y !== undefined ? snapGuide.y : 5000}
                                stroke="#3b82f6"
                                strokeWidth="1"
                                strokeDasharray="4,4"
                                className="opacity-40"
                            />
                        )}

                        {selectionBox && (
                            <rect
                                x={Math.min(selectionBox.startX, selectionBox.currentX)}
                                y={Math.min(selectionBox.startY, selectionBox.currentY)}
                                width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                                height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                                fill="rgba(59, 130, 246, 0.1)"
                                stroke="#3b82f6"
                                strokeWidth="1"
                                strokeDasharray="4,4"
                            />
                        )}
                    </svg>

                    {/* NODES LAYER */}
                    {nodes.map(node => (
                        <Card
                            key={node.id}
                            node={node}
                            isSelected={selectedNodeIds.includes(node.id)}
                            isDraggingNode={isDraggingNode}
                            potentialTargetId={potentialTargetId}
                            onMouseDown={handleNodeMouseDown}
                            onHandleMouseDown={handleHandleMouseDown}
                            onDelete={deleteNode}
                            onResize={handleResizeMouseDown}
                            onUpdate={updateNode}
                        />
                    ))}
                </div>
            </div>

            {/* BACK TO HUB BUTTON (FAR LEFT) */}
            <div className="absolute top-6 left-16 z-[60]">
                <button
                    onClick={() => {
                        setActiveRoadmapId(null);
                        navigate('/Growth/roadmap', { replace: true, state: { exitedToHub: true } });
                    }}
                    className="ml-2 flex items-center gap-2 pl-2 pr-4 py-2 bg-black/50 backdrop-blur-md border border-white/5 rounded-lg text-[10px] text-zinc-400 font-bold uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all cursor-pointer pointer-events-auto"
                >
                    <LocalIcon src={leftIcon} size={12} opacity="opacity-50" />
                    Back to Hub
                </button>
            </div>

            {/* INFO OVERLAY */}
            <div className="absolute top-6 right-6 flex items-center gap-4 z-[60]">
                {location.state?.fromGoal && activeRoadmapId === location.state?.roadmapId && (
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <button
                            onClick={() => navigate('/Growth/goals')}
                            className="flex items-center gap-2 pl-2 pr-4 py-2 bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                        >
                            <LocalIcon src={leftIcon} size={12} className="text-emerald-500" />
                            Back to Goals
                        </button>
                        {location.state?.skillId && (
                            <button
                                onClick={() => navigate('/Growth/skills', {
                                    state: {
                                        skillId: location.state.skillId,
                                        fromGoal: true,
                                        goalName: location.state.goalName,
                                        goalId: location.state.goalId,
                                        roadmapId: location.state.roadmapId,
                                        journalId: location.state.journalId
                                    }
                                })}
                                className="flex items-center gap-2 pl-2 pr-4 py-2 bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-lg text-[10px] text-amber-400 font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                            >
                                <LocalIcon src={brainIcon} size={12} className="text-amber-500" />
                                Go to Skills
                            </button>
                        )}

                        {location.state?.journalId && (
                            <button
                                onClick={() => navigate('/DailyJournal', {
                                    state: {
                                        targetTitle: location.state.goalName,
                                        fromGoal: true,
                                        roadmapId: location.state.roadmapId,
                                        goalId: location.state.goalId,
                                        skillId: location.state.skillId
                                    }
                                })}
                                className="flex items-center gap-2 pl-2 pr-4 py-2 bg-blue-500/10 backdrop-blur-md border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                            >
                                <LocalIcon src={journalIcon} size={12} className="text-blue-500" />
                                Go to Journal
                            </button>
                        )}
                    </div>
                )}
                <div className="bg-black/50 backdrop-blur-md border border-white/5 px-4 py-2 rounded-lg text-[10px] font-mono text-zinc-500 pointer-events-none">
                    <span className="text-white font-bold uppercase mr-2">
                        {roadmapsList.find(r => r.id === activeRoadmapId)?.title || "UNTITLED ROADMAP"}
                    </span>
                    • {nodes.length} NODES
                </div>
            </div>

            {/* SIDEBAR */}
            <div
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className={`fixed top-0 right-0 h-full w-80 bg-zinc-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transform z-[70] ${isInteracting ? '' : 'transition-transform duration-300'} ${showSidebar ? 'translate-x-0' : 'translate-x-full invisible'}`}
            >
                {showSidebar && (() => {
                    const node = nodes.find(n => n.id === selectedNodeIds[0]);
                    if (!node) return null;
                    const theme = COLORS[node.color] || COLORS.blue;

                    return (
                        <div className="flex flex-col h-full font-sans">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${theme.text.replace('text', 'bg')} shadow-[0_0_10px_currentColor]`}></div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Node Properties</span>
                                </div>
                                <button onClick={() => setSidebarOpenNodeId(null)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                                    <LocalIcon src={closeIcon} size={16} opacity="opacity-50" />
                                </button>
                            </div>

                            <div className="p-5 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Title / Label</label>
                                    <input
                                        ref={sidebarInputRef}
                                        key={node.id}
                                        type="text"
                                        value={node.title}
                                        onFocus={() => pushToHistory(nodes, connections)}
                                        onChange={(e) => updateNode(node.id, { title: e.target.value })}
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold select-text"
                                        placeholder="Enter node title..."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Appearance / Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(COLORS).map(([key, theme]) => (
                                            <button
                                                key={key}
                                                onClick={() => { pushToHistory(nodes, connections); updateNode(node.id, { color: key }); }}
                                                className={`w-8 h-8 rounded-lg border-2 transition-all ${theme.border} ${theme.bg} ${node.color === key ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'} flex items-center justify-center cursor-pointer`}
                                            >
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Typography / Styling</label>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { pushToHistory(nodes, connections); updateNode(node.id, { fontWeight: node.fontWeight === 'bold' ? 'normal' : 'bold' }); }}
                                                className={`flex-1 py-2 rounded-lg border border-zinc-800 text-xs font-bold transition-all cursor-pointer ${node.fontWeight === 'bold' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                                            >
                                                Bold
                                            </button>
                                            <button
                                                onClick={() => { pushToHistory(nodes, connections); updateNode(node.id, { fontStyle: node.fontStyle === 'italic' ? 'normal' : 'italic' }); }}
                                                className={`flex-1 py-2 rounded-lg border border-zinc-800 text-xs italic transition-all cursor-pointer ${node.fontStyle === 'italic' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                                            >
                                                Italic
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1">
                                            {Object.keys(SIZE_MAP).map(sz => (
                                                <button
                                                    key={sz}
                                                    onClick={() => { pushToHistory(nodes, connections); updateNode(node.id, { fontSize: sz }); }}
                                                    className={`py-2 rounded-lg border border-zinc-800 text-[10px] font-bold uppercase transition-all cursor-pointer ${node.fontSize === sz || (!node.fontSize && sz === 'md') ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                                                >
                                                    {sz}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Quick Connect / Directional Spawn</label>
                                    <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5 w-full divide-x divide-white/5 overflow-hidden">
                                        <button
                                            onClick={() => spawnNodeInDirection('left')}
                                            className="flex-1 p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                            title="Spawn Left"
                                        >
                                            <LocalIcon src={leftIcon} size={16} />
                                        </button>
                                        <button
                                            onClick={() => spawnNodeInDirection('up')}
                                            className="flex-1 p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                            title="Spawn Up"
                                        >
                                            <LocalIcon src={upIcon} size={16} />
                                        </button>
                                        <button
                                            onClick={() => spawnNodeInDirection('down')}
                                            className="flex-1 p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                            title="Spawn Down"
                                        >
                                            <LocalIcon src={downIcon} size={16} />
                                        </button>
                                        <button
                                            onClick={() => spawnNodeInDirection('right')}
                                            className="flex-1 p-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                            title="Spawn Right"
                                        >
                                            <LocalIcon src={rightIcon} size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 text-center">
                                    <button
                                        onMouseDown={(e) => { e.stopPropagation(); deleteNode(node.id); setSelectedNodeIds([]); }}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
                                    >
                                        <LocalIcon src={trashIcon} size={14} className="brightness-0 invert-0" /> Delete Node
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
            {renderModals()}
        </div >
    );
};

export default WorkflowCanvas;
