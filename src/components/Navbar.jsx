import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import React from 'react';
import { useData } from '../contexts/DataContext';
import home from '../assets/icons/home.svg'
import Dayplanner from '../assets/icons/dayplanner.svg';

import Finances from '../assets/icons/Finances.svg'
import Accounts from '../assets/icons/accounts.svg'
import CalendarIcon from '../assets/icons/calendar.svg'
import booktype from '../assets/icons/booktype.svg'
import Goals from '../assets/icons/goals.svg'
import Journal from '../assets/icons/journal.svg'
import Books from '../assets/icons/book.svg'
import Concepts from '../assets/icons/concepts.svg'
import Plans from '../assets/icons/Plans.svg'
import MusicIcon from '../assets/icons/music.svg'
import PlayIcon from '../assets/icons/play.svg'
import BrainIcon from '../assets/icons/brain.svg'
import EyeIcon from '../assets/icons/eye.svg';
import chartIcon from '../assets/icons/chart.svg'
import editIcon from '../assets/icons/edit.svg';


const Navbar = () => {
    const { data } = useData();
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        { icon: home, name: 'Home', path: '/' },
        { icon: Dayplanner, name: 'Day Planner', path: '/Parentview' },
        { icon: Books, name: 'Books', path: '/Books' },
        { icon: Finances, name: 'Finances', path: '/Finances' },
        { icon: MusicIcon, name: 'Music', path: '/Music' },
        { icon: Plans, name: 'Growth', path: '/Growth' },
        { icon: BrainIcon, name: 'Training', path: '/Training' },
        { icon: Concepts, name: 'Languages', path: '/Language' },
        { icon: Accounts, name: 'Accounts', path: '/Accounts' },
        { icon: PlayIcon, name: 'Media', path: '/Media' },
        { icon: Journal, name: 'Journal', path: '/DailyJournal' },
    ];

    const handleIconClick = (e, itemPath) => {
        // If clicking a parent route we are already on (or inside), navigate to first child
        if (itemPath !== '/' && location.pathname.startsWith(itemPath)) {
            e.preventDefault();
            let target = itemPath;
            
            // Map parent routes to their intended first child and update persistence
            if (itemPath === '/Parentview') {
                target = '/Parentview/timetracker';
                localStorage.setItem('axo_parentview_last_view', 'timetracker');
            }
            else if (itemPath === '/Books') {
                target = '/Books/books';
                localStorage.setItem('axo_books_last_view', 'books');
            }
            else if (itemPath === '/Growth') {
                target = '/Growth/goals';
                localStorage.setItem('axo_growth_last_view', 'goals');
            }
            else if (itemPath === '/Language') {
                target = '/Language/learning';
                localStorage.setItem('axo_language_last_view', 'learning');
            }
            else if (itemPath === '/Media') {
                target = '/Media/tv';
                localStorage.setItem('axo_media_last_view', 'tv');
            }
            else if (itemPath === '/Training') {
                target = '/Training'; // Hub is index
            }
            
            navigate(`${target}?t=${Date.now()}`);
        }
    };

    return (
        <div className="fixed top-0 left-0 h-full w-12 bg-black/40 backdrop-blur-xl border-r border-white/5 z-[100]">
            <div className='flex flex-col items-center py-6 h-full'>
                <ul className='space-y-3 w-full flex flex-col items-center flex-grow'>
                    {menuItems.map((item, index) => (
                        <li key={index} className="w-full flex justify-center">
                            <NavLink
                                to={item.path}
                                onClick={(e) => handleIconClick(e, item.path)}
                                className={({ isActive }) =>
                                    `group relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 cursor-pointer ${isActive
                                        ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-105'
                                        : 'hover:bg-white/5'
                                    }`
                                }
                                title={item.name}
                            >
                                {({ isActive }) => (
                                    <>
                                        <img
                                            src={item.icon}
                                            alt={item.name}
                                            className={`w-4 h-4 transition-all duration-300 ${isActive
                                                ? 'filter brightness-0 contrast-200'
                                                : 'filter brightness-0 invert opacity-40 group-hover:opacity-100'
                                                }`}
                                        />

                                        {/* Tooltip */}
                                        <span className="absolute left-full ml-4 px-3 py-1.5 bg-[#0a0a0a] border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 whitespace-nowrap shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
                                            {item.name}
                                        </span>

                                        {/* Active Indicator Line */}
                                        {isActive && (
                                            <div className="absolute -left-1.5 w-1 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                                        )}

                                        {/* Active Session Red Dot for Day Planner */}
                                        {item.name === 'Day Planner' && data?.time?.activeSession && (
                                            <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full border border-black shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" />
                                        )}

                                        {/* Reward Usage Active Indicator for Growth */}
                                        {item.name === 'Growth' && data?.rewards?.isBalancedActive && (
                                            <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full border border-black shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

export default Navbar