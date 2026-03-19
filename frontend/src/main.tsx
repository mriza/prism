import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

// Global Fetch Interceptor to attach JWT
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const [resource, config] = args;
    const token = localStorage.getItem('prism_token');
    
    // Don't intercept login requests to avoid circular logic
    if (typeof resource === 'string' && resource.includes('/api/auth/login')) {
        return originalFetch(resource, config);
    }

    const newConfig = { ...config };
    if (token) {
        newConfig.headers = {
            ...(newConfig.headers || {}),
            'Authorization': `Bearer ${token}`
        };
    }
    
    const response = await originalFetch(resource, newConfig);
    
    // Auto-logout on 401 Unauthorized (optional but good practice)
    if (response.status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('prism_token');
        window.location.href = '/login';
    }
    
    return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
