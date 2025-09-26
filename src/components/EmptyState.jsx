export default function EmptyState({ message = 'Nenhum dado disponível' }) {
  return (
    <div className="card text-center py-12">
      <p className="muted">{message}</p>
    </div>
  );
}