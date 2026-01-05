import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { RoundEditor } from './pages/RoundEditor'
import { EventEditor } from './pages/EventEditor'
import { Presentation } from './pages/Presentation'
import { PrintView } from './pages/PrintView'
import { Settings } from './pages/Settings'
import './App.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rounds/new"
        element={
          <ProtectedRoute>
            <RoundEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rounds/:id/edit"
        element={
          <ProtectedRoute>
            <RoundEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <EventEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id/edit"
        element={
          <ProtectedRoute>
            <EventEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id/present"
        element={
          <ProtectedRoute>
            <Presentation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id/print"
        element={
          <ProtectedRoute>
            <PrintView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
