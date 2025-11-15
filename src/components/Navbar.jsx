import {NavLink } from 'react-router-dom';
import home from '../assets/icons/home.svg'
import Dayplanner from '../assets/icons/dayplanner.svg';
import Time from '../assets/icons/Time.svg'
import Finances from '../assets/icons/Finances.svg'
import Accounts from '../assets/icons/accounts.svg'
import Calendar from '../assets/icons/calendar.svg'
import Todos from '../assets/icons/todos.svg'
import Goals from '../assets/icons/goals.svg'
import Journal from '../assets/icons/journal.svg'
import Books from '../assets/icons/book.svg'
import Concepts from '../assets/icons/concepts.svg'
import Plans from '../assets/icons/Plans.svg'
import React from 'react';
import {useState} from 'react'


const Navbar = () => {
    const [Hovered, setHovered] = useState(false)

    const menuItems = [
        {icon: home , name: 'Home', path: '/'},
        {icon: Dayplanner, name: 'Day Planner', path: '/Dayplanner'},
        {icon: Time, name: 'Time Tracker', path: '/Timetracker'},
        {icon: Todos, name: 'Todos', path:'/Todos'},
        {icon: Goals, name:'Goals', path: '/Goals'},
        {icon: Journal, name: 'Journal', path: '/Journal'},
        {icon: Books, name: 'Books', path:'/Books'},
        {icon: Finances, name:'Finances', path:'/Finances'},
        {icon: Accounts, name:'Accounts', path:'/Accounts'},
        {icon: Plans, name: 'Plans', path: '/Plans'},
        {icon: Concepts, name: 'Concepts', path:'/Concepts'},
        {icon:Calendar, name:'Calendar', path:'/Calendar'},
    ];
    return(
        <div
            className={`  fixed top-0 left-0 h-full bg-gray-800/10 backdrop-blur-xs transition-all duration-300 ease-in-out ${
                Hovered ? 'lg:w-64 md:w-36': 'w-16 lg:w-16 md:w-14'
            }` } 
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)} >
                <div className='flex flex-col items-center gap-1 p-'>
                    <ul className='space-y-4 w-full'>
                        {menuItems.map((item, index) => (
                            <li key={index}>
                                <NavLink to={item.path} className={({isActive}) =>
                                `flex items-center px-4 py-2 transition-colors duration-200 ${
                                    isActive ? 'bg-blue-600 hover:bg-blue-900 text-white' : 'text-gray-300 hover:bg-gray-700'
                                }`
                                }>
                                    <img src={item.icon} />
                                    <span className={`ml-1 transition-opacity duration-100 whitespace-nowrap ${Hovered ? "opacity-100": "opacity-0"}` }>
                                        {item.name}
                                    </span>
                                </NavLink>
                            </li>
                        ))}

                    </ul>

                </div>
                
        
        </div>
    )
}
export default Navbar