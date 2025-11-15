import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import Home from './components/Home'  // Remove the curly braces
import Dayplanner from './components/Dayplanner'
import Timetracker from './components/TimeTracker';
const root = createRoot(document.body);
root.render(
    <HashRouter>
        <Routes>
            <Route path='/' element={<Home/>}/>
            <Route path='/Dayplanner' element={<Dayplanner />} />
            <Route path='/Timetracker' element={<Timetracker />} />

        </Routes>
    
    </HashRouter>
);