import React, { useMemo, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PagesLogTracker = ({ logs = [], isInner = false, view = null, onViewChange = null }) => {
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
    // Generate last 7 days data
    const chartData = useMemo(() => {
        const data = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            
            // Format label (e.g., "Mon", "Tue" or "Jul 29")
            const label = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
            
            const startOfDay = new Date(date);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            // Calculate total pages for this day
            let totalPages = 0;
            const booksRead = {};

            logs.forEach(log => {
                const logDate = new Date(log.date);
                if (logDate >= startOfDay && logDate <= endOfDay) {
                    totalPages += log.pages;
                    if (!booksRead[log.bookName]) {
                        booksRead[log.bookName] = 0;
                    }
                    booksRead[log.bookName] += log.pages;
                }
            });

            if (totalPages < 0) totalPages = 0;

            data.push({
                date,
                label,
                pages: totalPages,
                books: Object.keys(booksRead)
                        .filter(name => booksRead[name] > 0)
                        .map(name => ({ name, pages: booksRead[name] }))
            });
        }
        return data;
    }, [logs]);

    const totalLast7Days = chartData.reduce((sum, day) => sum + day.pages, 0);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl z-50 min-w-[150px]">
                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{data.label}</p>
                    <p className="text-xl font-black text-white mb-3">{data.pages} <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pages</span></p>
                    
                    {data.books.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                            {data.books.map((book, idx) => (
                                <div key={idx} className="flex justify-between items-center gap-4">
                                    <span className="text-[10px] text-gray-300 truncate max-w-[120px]">{book.name}</span>
                                    <span className="text-[10px] font-bold text-blue-400">+{book.pages}</span>
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
                            <h3 className="text-sm font-bold text-white tracking-tight">Reading Tracker</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Last 7 Days</p>
                        </div>
                    )}
                </div>
                
                <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white tracking-tighter">{totalLast7Days}</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Pages</span>
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
                        <Tooltip content={() => null} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                        <Bar dataKey="pages" radius={[4, 4, 4, 4]} maxBarSize={40}>
                            {
                                chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 6 ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)'} className="transition-all duration-300 hover:fill-blue-400" />
                                ))
                            }
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

export default PagesLogTracker;
