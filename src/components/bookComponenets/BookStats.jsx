// src/components/bookComponenets/BookStats.jsx

import React from 'react';
import { useData } from '../../contexts/DataContext';

import BookOpenIcon from '../../assets/icons/book.svg';
import ClockIcon from '../../assets/icons/clock.svg';
import CheckCircleIcon from '../../assets/icons/check.svg';

const BookStats = () => {
  const { data } = useData();

  const counts = {
    wantToRead: data.reading?.shelves?.WanttoRead?.length || 0,
    reading: data.reading?.shelves?.Reading?.length || 0,
    read: data.reading?.shelves?.Read?.length || 0,
  };

  const loading = !data.reading;

  const stats = [
    {
      title: 'Current',
      count: counts.reading,
      icon: ClockIcon,
      color: 'filter-amber',
      bg: 'bg-amber-500/10'
    },
    {
      title: 'Queue',
      count: counts.wantToRead,
      icon: BookOpenIcon,
      color: 'filter-blue',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Finished',
      count: counts.read,
      icon: CheckCircleIcon,
      color: 'filter-emerald',
      bg: 'bg-emerald-500/10'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.title}
            className="group relative overflow-hidden bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl border border-white/5 p-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center border border-white/5 transition-transform duration-500 group-hover:rotate-6`}>
                  <img
                    src={stat.icon}
                    className="w-6 h-6"
                    style={{
                      filter: stat.color === 'filter-amber'
                        ? 'invert(87%) sepia(21%) saturate(2259%) hue-rotate(352deg) brightness(101%) contrast(101%)'
                        : stat.color === 'filter-blue'
                          ? 'invert(60%) sepia(61%) saturate(3685%) hue-rotate(195deg) brightness(102%) contrast(102%)'
                          : 'invert(75%) sepia(65%) saturate(384%) hue-rotate(92deg) brightness(98%) contrast(93%)'
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-0.5">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-white tracking-tight">{stat.count}</p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse`} style={{
                    backgroundColor: stat.color === 'filter-amber' ? '#fbbf24' : stat.color === 'filter-blue' ? '#60a5fa' : '#34d399'
                  }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BookStats;