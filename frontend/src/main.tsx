import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/utilities.css';
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'

// Global Fetch Interceptor to attach JWT
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const [resource, config] = args;
    const token = localStorage.getItem('prism_token');
    
	const resourceStr = typeof resource === 'string' ? resource : ('url' in resource ? resource.url : resource.href);
    
    // Don't intercept login requests to avoid circular logic
    if (resourceStr.includes('/api/auth/login')) {
        return originalFetch(resource, config);
    }

	// Only attach token if the request is to our API
	const isApiRequest = resourceStr.startsWith('/') || resourceStr.includes(import.meta.env.VITE_API_URL || window.location.origin);

    const newConfig = { ...config };
    if (token && isApiRequest) {
        newConfig.headers = {
            ...(newConfig.headers || {}),
            'Authorization': `Bearer ${token}`
        };
    }
    
    const response = await originalFetch(resource, newConfig);
    
    // Auto-logout on 401 Unauthorized
    // Only apply this to our own API to prevent external APIs (like GitHub) from logging us out
    if (response.status === 401 && isApiRequest && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('prism_token');
        window.location.href = '/login';
    }
    
    return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
