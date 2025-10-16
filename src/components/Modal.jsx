import { useEffect } from "react";

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      display:"grid", placeItems:"center", zIndex: 80
    }}
      onClick={onClose}
    >
      <div
        className="chart-card"
        style={{ width:"min(560px, 92vw)" }}
        onClick={(e)=>e.stopPropagation()}
      >
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          <h3 style={{margin:0, fontSize:16}}>{title}</h3>
          <button onClick={onClose} style={{all:"unset", cursor:"pointer"}} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
