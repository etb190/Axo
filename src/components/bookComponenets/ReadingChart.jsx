// src/components/bookComponenets/ReadingChart.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import ZapIcon from '../../assets/icons/zap.svg';
import TrendingUpIcon from '../../assets/icons/chart.svg';

const ReadingChart = () => {
  const { data } = useData();
  const [monthlyData, setMonthlyData] = useState([]);
  const [stats, setStats] = useState({ total: 0, growth: 0 });

  useEffect(() => {
    if (!data.reading || !data.reading.shelves || !data.reading.shelves.Read) return;

    const readBooks = data.reading.shelves.Read;
    const monthMap = {};

    for (const book of readBooks) {
      const date = new Date(book.createdAt);
      if (!isNaN(date)) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap[key] = (monthMap[key] || 0) + 1;
      }
    }

    const today = new Date();
    const chartData = [];
    // Show 7 months (current + 6 previous) for a tight focus
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      chartData.push({
        month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
        count: monthMap[key] || 0,
        fullKey: key
      });
    }

    // Calculate simple trend
    const currentCount = chartData[chartData.length - 1].count;
    const prevCount = chartData[chartData.length - 2].count;
    const growth = prevCount === 0 ? currentCount * 100 : Math.round(((currentCount - prevCount) / prevCount) * 100);

    setMonthlyData(chartData);
    setStats({ total: readBooks.length, growth });
  }, [data.reading]); // dependency on data.reading

  const loading = !data.reading;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl">
          <p className="text-[10px] font-black text-blue-500 tracking-widest mb-1">{payload[0].payload.month}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{payload[0].value}</span>
            <span className="text-[10px] text-gray-500 font-medium">BOOKS COMPLETED</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />;

  return (
    <div className="relative group">
      {/* Smart Header Section */}
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.3em] text-blue-500 uppercase">
            <img src={ZapIcon} className="w-2.5 h-2.5 brightness-0 invert sepia(1) saturate(5) hue-rotate(190deg)" style={{ filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(202deg) brightness(118%) contrast(119%)' }} />
            Cognitive Consumption
          </div>
          <h3 className="text-xl font-bold text-white flex items-baseline gap-2">
            {stats.total}
            <span className="text-[10px] font-medium text-gray-500 tracking-normal uppercase">Volumes Finalized</span>
          </h3>
        </div>

        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${stats.growth >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <img src={TrendingUpIcon} className={`w-3 h-3 ${stats.growth < 0 ? 'rotate-180' : ''}`} style={{ filter: stats.growth >= 0 ? 'invert(68%) sepia(35%) saturate(733%) hue-rotate(104deg) brightness(98%) contrast(90%)' : 'invert(40%) sepia(91%) saturate(3015%) hue-rotate(338deg) brightness(101%) contrast(106%)' }} />
            <span className="text-[11px] font-black">{Math.abs(stats.growth)}%</span>
          </div>
          <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">Velocity Index</span>
        </div>
      </div>

      {/* Ultra-Compact Graphic */}
      <div className="h-28 w-full overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -45, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 900 }}
              dy={10}
            />
            <YAxis hide domain={[0, 'dataMax + 2']} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
            <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={24}>
              {monthlyData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === monthlyData.length - 1 ? 'url(#activeGradient)' : 'url(#barGradient)'}
                  className="transition-all duration-500"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Decorative Background Grid */}
      <div className="absolute inset-x-0 bottom-0 h-28 border-b border-white/5 pointer-events-none -z-10 bg-gradient-to-t from-blue-500/[0.02] to-transparent" />
    </div>
  );
};

export default ReadingChart;
