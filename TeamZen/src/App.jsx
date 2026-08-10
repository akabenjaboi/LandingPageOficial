import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './App.css'
import LoadingSpinner from './components/LoadingSpinner.jsx'

const Home = lazy(() => import('./pages/home.jsx'))
const LoginPage = lazy(() => import('./pages/loginpage.jsx'))
const Dashboard = lazy(() => import('./pages/dashboard.jsx'))
const CrearEquipo = lazy(() => import('./pages/crear-equipo.jsx'))
const UnirseEquipo = lazy(() => import('./pages/unirse-equipo.jsx'))
const MBIPage = lazy(() => import('./pages/mbi.jsx'))
const EvaluacionesPage = lazy(() => import('./pages/evaluaciones.jsx'))
const ReportesPage = lazy(() => import('./pages/reportes.jsx'))

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner size="large" />}>
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
      </Suspense>
    </Router>
  )
}

export default App
