export default function Section({ title, right = null, description = null, className = "", children }) {
  const sectionClassName = ["section", className].filter(Boolean).join(" ");
  return (
    <section className={sectionClassName} style={{ padding: 0, marginTop: 18 }}>
      {(title || right) && (
        <div className="section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
          <div className="section__titles" style={{ flex: "1 1 auto" }}>
            {title && <h2 className="section__title" style={{ margin: 0, fontSize: 16 }}>{title}</h2>}
            {description && <p className="muted section__description" style={{ margin: "4px 0 0" }}>{description}</p>}
          </div>
          {right && <div style={{ flexShrink: 0 }}>{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
