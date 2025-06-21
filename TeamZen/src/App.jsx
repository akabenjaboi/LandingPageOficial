import React from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './App.css'
import Home from './pages/home.jsx'
import LoginPage from './pages/loginpage.jsx'
import Dashboard from './pages/dashboard.jsx'
import CrearEquipo from './pages/crear-equipo.jsx';
import UnirseEquipo from './pages/unirse-equipo.jsx';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<Home />} />
        <Route path="/LandingPageOficial/login" element={<LoginPage />} />
        <Route path="/LandingPageOficial/dashboard" element={<Dashboard />} />
        <Route path="/LandingPageOficial/crear-equipo" element={<CrearEquipo />} />
        <Route path="/LandingPageOficial/unirse-equipo" element={<UnirseEquipo />} />
      </Routes>
      <div className="bg-teamzen-circles">
        <span className="circle-mint"></span>
        <span className="circle-purple"></span>
        <span className="circle-gray"></span>
      </div>
    </Router>
  )
}

export default App
