import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import DashboardHome from './pages/DashboardHome';
import FacebookDashboard from './pages/FacebookDashboard';
import InstagramDashboard from './pages/InstagramDashboard';
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
      { path: '/', element: <DashboardHome /> },
      { path: '/facebook', element: <FacebookDashboard /> },
      { path: '/instagram', element: <InstagramDashboard /> },
      { path: '/relatorios', element: <Reports /> },
      { path: '/configuracoes', element: <Settings /> },
      { path: '/admin', element: <Admin /> },
      { path: '*', element: <DashboardHome /> },
    ],
  },
]);

export default function RootRouter() {
  return <RouterProvider router={router} />;
}
