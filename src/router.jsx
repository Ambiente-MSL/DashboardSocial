import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import DashboardHome from './pages/DashboardHome';
import FacebookDashboard from './pages/FacebookDashboard';
import InstagramDashboard from './pages/InstagramDashboard';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <App />,
    children: [
      { path: '/', element: <DashboardHome /> },
      { path: '/facebook', element: <FacebookDashboard /> },
      { path: '/instagram', element: <InstagramDashboard /> },
      { path: '/relatorios', element: <Reports /> },
      { path: '/configuracoes', element: <Settings /> },
      { path: '*', element: <DashboardHome /> },
    ],
  },
]);

export default function RootRouter() {
  return <RouterProvider router={router} />;
}
