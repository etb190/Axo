// src/components/bookComponenets/BookStats.jsx

import React from 'react';
import { useData } from '../../contexts/DataContext';

const BookStats = () => {
  const { data } = useData();

  const counts = {
    reading: data.reading?.shelves?.Reading?.length || 0,
    wantToRead: data.reading?.shelves?.WanttoRead?.length || 0,
    read: data.reading?.shelves?.Read?.length || 0,
  };

  const loading = !data.reading;

  const stats = [
    {
      title: 'Currently Reading',
      count: counts.reading,
      colorClass: 'text-white',
      bgClass: 'bg-white/5 border-white/10'
    },
    {
      title: 'Want to Read',
      count: counts.wantToRead,
      colorClass: 'text-white',
      bgClass: 'bg-white/5 border-white/10'
    },
    {
      title: 'Finished Reading',
      count: counts.read,
      colorClass: 'text-white',
      bgClass: 'bg-white/5 border-white/10'
    }
  ];

  if (loading) {
    return (
      <div className="flex gap-4 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-12 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 mb-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className={`flex-1 flex items-center justify-between px-4 py-2 rounded-xl border ${stat.bgClass} backdrop-blur-md`}
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.title}</span>
          <span className={`text-base font-black ${stat.colorClass}`}>{stat.count}</span>
        </div>
      ))}
    </div>
  );
};

export default BookStats;