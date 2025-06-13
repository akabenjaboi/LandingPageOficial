import React from 'react'
import './App.css'
import Navbar from './components/navbar.jsx'
import Home from './pages/home.jsx' // <-- Agrega esta línea

function App() {
  
  return (
    <>
      <Navbar />
      <Home />
      <div className="bg-teamzen-circles">
        <span className="circle-mint"></span>
        <span className="circle-purple"></span>
        <span className="circle-gray"></span>
      </div>
    </>
  )
}

export default App
