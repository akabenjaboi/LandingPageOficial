import React from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './App.css'
import Home from './pages/home.jsx'
import LoginPage from './pages/loginpage.jsx'
import Dashboard from './pages/dashboard.jsx'
import CrearEquipo from './pages/crear-equipo.jsx';
import UnirseEquipo from './pages/unirse-equipo.jsx';
import MBIPage from './pages/mbi.jsx';
import EvaluacionesPage from './pages/evaluaciones.jsx';
import ReportesPage from './pages/reportes.jsx';


function App() {
  return (
    <Router basename="/LandingPageOficial">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crear-equipo" element={<CrearEquipo />} />
        <Route path="/unirse-equipo" element={<UnirseEquipo />} />
  <Route path="/mbi" element={<MBIPage />} />
  <Route path="/evaluaciones" element={<EvaluacionesPage />} />
  <Route path="/reportes" element={<ReportesPage />} />
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
