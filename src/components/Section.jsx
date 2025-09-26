export default function Section({ title, right = null, description = null, children }) {
  return (
    <section className="section">
      <div className="section__header">
        <div className="section__titles">
          <h2 className="section__title">{title}</h2>
          {description && <p className="section__description">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
