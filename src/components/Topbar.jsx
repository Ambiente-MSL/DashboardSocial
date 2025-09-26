import { Filter, Menu, X } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import AccountSelect from './AccountSelect';

export default function Topbar({ title, sidebarOpen, onToggleSidebar }) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        {onToggleSidebar && (
          <button
            type="button"
            className="topbar__icon-button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
        <div className="topbar__titles">
          <h1 className="topbar__title">{title}</h1>
          <p className="topbar__breadcrumb">Início &gt; {title}</p>
        </div>
      </div>
      <div className="topbar__filters">
        <AccountSelect />
        <DateRangePicker />
        <button type="button" className="filter-button">
          <Filter size={16} />
          <span>Filtrar</span>
        </button>
      </div>
    </header>
  );
}
