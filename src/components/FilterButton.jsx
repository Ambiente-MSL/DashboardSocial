import { useState, useRef, useEffect } from "react";
import { Filter, Check } from "lucide-react";

export default function FilterButton({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className="filter-button-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="filter-button"
        onClick={() => setIsOpen(!isOpen)}
        data-open={isOpen || undefined}
      >
        <Filter size={16} />
        <span>Filtros</span>
      </button>

      {isOpen && (
        <div className="filter-dropdown">
          <div className="filter-dropdown__header">Visualizar</div>
          <div className="filter-dropdown__options">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`filter-dropdown__option ${
                  option.value === value ? "filter-dropdown__option--active" : ""
                }`}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
