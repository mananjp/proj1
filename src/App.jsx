import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Contact from './pages/Contact'

import Resources from './pages/resources'

// Placeholders for other routes mapped to Contact for now
const Placeholder = ({ title }) => (
  <div className="page-container">
    <h1>{title}</h1>
    <p>This is a placeholder page.</p>
  </div>
)

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/media" element={<Placeholder title="Media" />} />
        <Route path="/projects" element={<Placeholder title="Projects" />} />
        <Route path="/resume" element={<Placeholder title="Resume" />} />
        <Route path="/resources" element={<Resources />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
