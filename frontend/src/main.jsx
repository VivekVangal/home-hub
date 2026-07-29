import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { FamilyProvider } from './context/FamilyContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FamilyProvider>
          <App />
        </FamilyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
