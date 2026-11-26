export default function EmptyState({ icon: Icon, title, text, good, children }) {
  return (
    <div className={`gt-empty${good ? " good" : ""}`}>
      <div className="gt-empty-icon"><Icon size={24} strokeWidth={1.8} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
