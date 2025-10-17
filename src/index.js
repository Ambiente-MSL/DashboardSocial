import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import RootRouter from './router';
import { ThemeProvider } from './context/ThemeContext';
import { AccountsProvider } from './context/AccountsContext';
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <AccountsProvider>
          <RootRouter />
        </AccountsProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
