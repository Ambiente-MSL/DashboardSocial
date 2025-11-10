import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import App from './App';
import FacebookDashboard from './pages/FacebookDashboard';
import InstagramDashboard from './pages/InstagramDashboard';
import AdsDashboard from './pages/AdsDashboard';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    element: <App />,
    children: [
      { path: '/', element: <Navigate to='/instagram' replace /> },
      { path: '/facebook', element: <FacebookDashboard /> },
      { path: '/instagram', element: <InstagramDashboard /> },
      { path: '/ads', element: <AdsDashboard /> },
      { path: '/relatorios', element: <Reports /> },
      { path: '/configuracoes', element: <Settings /> },
      { path: '/admin', element: <Admin /> },
      { path: '*', element: <Navigate to='/instagram' replace /> },
    ],
  },
]);

export default function RootRouter() {
  return <RouterProvider router={router} />;
}
