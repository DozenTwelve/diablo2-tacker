// A page's title with how much of it is collected, "235 / 402", and a thin progress rule under it.
// Without totals it is just the title.
export default function PageTitle({ label, owned, total, children }) {
  const counted = total != null;
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="page-title">{label}</h1>
        {counted && (
          <span className="page-count">
            {owned} / {total}
          </span>
        )}
        {children && <div className="ml-auto">{children}</div>}
      </div>
      {counted && (
        <div className="progress-rule" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
          <div style={{ width: `${total ? (owned / total) * 100 : 0}%` }} />
        </div>
      )}
    </div>
  );
}
