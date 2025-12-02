import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Facebook,
  Instagram as InstagramIcon,
  Settings,
  Shield,
} from 'lucide-react';

const HERO_TABS = [
  { id: 'instagram', label: 'Instagram', href: '/instagram', icon: InstagramIcon },
  { id: 'facebook', label: 'Facebook', href: '/facebook', icon: Facebook },
  { id: 'ads', label: 'Ads', href: '/ads', icon: BarChart3 },
  { id: 'reports', label: 'Relatórios', href: '/relatorios', icon: FileText },
  { id: 'settings', label: 'Configurações', href: '/configuracoes', icon: Settings },
  { id: 'admin', label: 'Admin', href: '/admin', icon: Shield },
];

export default function NavigationHero({ title, icon: TitleIcon, gradient = 'default', showGradient = true }) {
  const location = useLocation();

  const gradientClass = gradient === 'facebook' ? 'facebook-dashboard--clean' : '';

  return (
    <>
      {showGradient && <div className={`ig-hero-gradient ${gradientClass}`} aria-hidden="true" />}

      <div className="ig-clean-header">
        <div className="ig-clean-header__brand">
          {TitleIcon && (
            <div className="ig-clean-header__logo">
              <TitleIcon size={32} />
            </div>
          )}
          <h1>{title}</h1>
        </div>

        <nav className="ig-clean-tabs">
          {HERO_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.href === location.pathname;

            return tab.href ? (
              <Link
                key={tab.id}
                to={tab.href}
                className={`ig-clean-tab${isActive ? ' ig-clean-tab--active' : ''}`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </Link>
            ) : (
              <button
                key={tab.id}
                type="button"
                className="ig-clean-tab"
                disabled
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
