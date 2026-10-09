import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CompletedItemsTracker = ({ books = [], articles = [], isInner = false, view = null, onViewChange = null }) => {
    const [filter, setFilter] = useState(() => localStorage.getItem('completedItemsFilter') || 'all');
    
    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        localStorage.setItem('completedItemsFilter', newFilter);
    };
    const [tooltipState, setTooltipState] = useState({ active: false, payload: null, coordinate: { x: 0, y: 0 }, index: 0 });
    const tooltipTimeout = useRef(null);

    const handleMouseMove = (state) => {
        if (state && state.activeTooltipIndex !== undefined && state.activeTooltipIndex !== null) {
            clearTimeout(tooltipTimeout.current);
            setTooltipState({
                active: true,
                payload: [{ payload: chartData[state.activeTooltipIndex] }],
                coordinate: state.activeCoordinate || { x: 0, y: 0 },
                index: state.activeTooltipIndex
            });
        }
    };

    const handleMouseLeave = () => {
        tooltipTimeout.current = setTimeout(() => {
            setTooltipState({ active: false, payload: null, coordinate: { x: 0, y: 0 }, index: 0 });
        }, 150);
    };

    const chartData = useMemo(() => {
        const data = [];
        const today = new Date();
        
        // Create an array of 7 months, going backwards
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthLabel = d.toLocaleString('en-US', { month: 'short' });
            
            const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            
            let completedBooks = [];
            let completedArticles = [];

            if (filter === 'all' || filter === 'books') {
                books.forEach(b => {
                    const completedAt = new Date(b.createdAt || b.lastUpdated || 0);
                    if (completedAt >= startOfMonth && completedAt <= endOfMonth) {
                        completedBooks.push(b);
                    }
                });
            }

            if (filter === 'all' || filter === 'articles') {
                articles.forEach(a => {
                    const completedAt = new Date(a.createdAt || a.lastUpdated || 0);
                    if (completedAt >= startOfMonth && completedAt <= endOfMonth) {
                        completedArticles.push(a);
                    }
                });
            }

            data.push({
                label: monthLabel,
                count: completedBooks.length + completedArticles.length,
                books: completedBooks.map(b => b.name),
                articles: completedArticles.map(a => a.name)
            });
        }
        return data;
    }, [books, articles, filter]);

    const totalLast7Months = chartData.reduce((sum, month) => sum + month.count, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl z-50 min-w-[150px]">
                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{data.label}</p>
                    <p className="text-xl font-black text-emerald-400 mb-3">{data.count} <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Completed</span></p>
                    
                    {(data.books.length > 0 || data.articles.length > 0) && (
                        <div className="space-y-1.5 pt-2 border-t border-white/5 max-h-[200px] overflow-y-auto pr-1">
                            {data.books.map((name, idx) => (
                                <div key={`b-${idx}`} className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                                    <span className="text-[10px] text-gray-300 truncate max-w-[200px]" title={name}>{name}</span>
                                </div>
                            ))}
                            {data.articles.map((name, idx) => (
                                <div key={`a-${idx}`} className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                    <span className="text-[10px] text-gray-300 truncate max-w-[200px]" title={name}>{name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className={isInner ? "w-full" : "bg-[#0a0a0a]/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 mb-4 group hover:bg-[#0a0a0a]/60 transition-all duration-300"}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    {onViewChange ? (
                        <div className="flex bg-white/5 rounded-lg p-1">
                            <button onClick={() => onViewChange('pages')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${view === 'pages' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Pages</button>
                            <button onClick={() => onViewChange('completed')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${view === 'completed' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Completed</button>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">Completed Items Tracker</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Last 7 Months</p>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex bg-white/5 rounded-lg p-1">
                        {['all', 'books', 'articles'].map(f => (
                            <button 
                                key={f}
                                onClick={() => handleFilterChange(f)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${filter === f ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-baseline gap-1.5 border-l border-white/10 pl-4">
                        <span className="text-3xl font-black text-emerald-400 tracking-tighter">{totalLast7Months}</span>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total</span>
                    </div>
                </div>
            </div>

            <div className="h-[120px] w-full mt-4 relative" onMouseLeave={handleMouseLeave}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={chartData} 
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                        onMouseMove={handleMouseMove}
                    >
                        <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                            dy={10}
                        />
                        <Tooltip content={() => null} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                        <Bar 
                            dataKey="count" 
                            radius={[4, 4, 4, 4]}
                            barSize={32}
                            animationDuration={1500}
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`}
                                    fill={entry.count > 0 ? (index === chartData.length - 1 ? '#34d399' : '#10b981') : '#1f2937'}
                                    fillOpacity={entry.count > 0 ? (index === chartData.length - 1 ? 1 : 0.6) : 0.3}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                {tooltipState.active && tooltipState.payload && (
                    <div 
                        className="absolute z-[100] pointer-events-auto transition-all duration-200 ease-out"
                        style={{ 
                            left: tooltipState.coordinate.x, 
                            top: 10,
                            transform: tooltipState.index >= chartData.length - 2 ? 'translateX(calc(-100% - 20px))' : 'translateX(20px)'
                        }}
                        onMouseEnter={() => clearTimeout(tooltipTimeout.current)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <CustomTooltip active={true} payload={tooltipState.payload} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompletedItemsTracker;
