import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import HomePage from './pages/HomePage.tsx'
import App from './App.tsx'
import Admin from './Admin.tsx'
import { TournamentsPage } from './pages/TournamentsPage.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/deck" element={<App />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>,
)
