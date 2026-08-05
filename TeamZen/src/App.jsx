import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
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

// The decorative "Jardin Zen" blur circles are part of the marketing landing
// page's visual identity. They use mix-blend-mode + filter:blur, one of the
// more GPU-expensive combos, and were previously rendered on every route
// (fixed, outside <Routes>) even though the authenticated app pages sit on
// solid backgrounds and don't need the ambient brand mood. Only render them
// on the landing page so app routes (dashboard, reportes, evaluaciones, mbi,
// crear-equipo, unirse-equipo) and the login screen skip the extra
// compositing layer.
function DecorativeCircles() {
  const { pathname } = useLocation()
  if (pathname !== '/') return null

  return (
    <div className="bg-teamzen-circles">
      <span className="circle-mint"></span>
      <span className="circle-purple"></span>
      <span className="circle-gray"></span>
    </div>
  )
}

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
      <DecorativeCircles />
    </Router>
  )
}

export default App
