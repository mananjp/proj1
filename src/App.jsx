import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Contact from './pages/Contact'
import Projects from './pages/Projects'
import Resources from './pages/resources'
import Tasks from './pages/Tasks'

import { AuthProvider, AuthContext } from './context/AuthContext'
import Auth from './pages/Auth'

// Placeholders for other routes mapped to Contact for now
const Placeholder = ({ title }) => (
  <div className="page-container">
    <h1>{title}</h1>
    <p>This is a placeholder page.</p>
  </div>
)

const PrivateRoute = ({ children }) => {
  const { user, loading } = React.useContext(AuthContext);
  
  if (loading) return <div className="page-container">Loading...</div>;
  if (!user) return <Auth />; // Render auth page if not logged in
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/tasks" element={
            <PrivateRoute>
              <Tasks />
            </PrivateRoute>
          } />
          <Route path="/contact" element={<Contact />} />
          <Route path="/media" element={<Placeholder title="Media" />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/resume" element={<Placeholder title="Resume" />} />
          <Route path="/resources" element={<Resources />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
