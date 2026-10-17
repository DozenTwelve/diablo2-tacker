export default function ProgressBar({ label, owned, total }) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <>
      <div className="gothic-stat">
        {label}：{owned} / {total}
      </div>
      <div className="gothic-progress-container">
        <div className="gothic-progress-bar" style={{ width: `${pct}%` }} />
        <div className="gothic-progress-label">{pct}%</div>
      </div>
    </>
  );
}
