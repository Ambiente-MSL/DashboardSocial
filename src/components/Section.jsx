export default function Section({ title, right = null, description = null, children, surface = true }) {
  const sectionClass = surface ? 'section section--surface' : 'section';

  return (
    <section className={sectionClass}>
      <div className="section__header">
        <div className="section__titles">
          <h2 className="section__title">{title}</h2>
          {description && <p className="section__description">{description}</p>}
        </div>
        {right}
      </div>
      <div className="section__body">
        {children}
      </div>
    </section>
  );
}
