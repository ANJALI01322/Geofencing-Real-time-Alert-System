import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers to show: always the first and last, and a window around the current page. */
export function pageItems(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const items = new Set([0, pages - 1, page - 1, page, page + 1]);
  const sorted = [...items].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

/**
 * Pagination bar: "Showing 51–100 of 234", Prev / numbered pages / Next.
 * `page` is zero-based. On phones the numbers collapse to Prev / Next.
 */
export default function Pager({ page, pageSize, total, onPage, loading = false }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <nav className="gt-pager" aria-label="Pagination">
      <span className="gt-pager-info">
        {total === 0 ? "No results" : <>Showing <b>{from}–{to}</b> of <b>{total}</b></>}
      </span>
      <div className="gt-pager-ctl">
        <button type="button" className="gt-pager-btn" onClick={() => onPage(page - 1)}
          disabled={loading || page <= 0} aria-label="Previous page">
          <ChevronLeft size={14} /> Prev
        </button>
        {pageItems(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`g${i}`} className="gt-pager-gap gt-pager-num">…</span>
          ) : (
            <button key={n} type="button" className={`gt-pager-btn gt-pager-num${n === page ? " active" : ""}`}
              onClick={() => onPage(n)} disabled={loading} aria-current={n === page ? "page" : undefined}>
              {n + 1}
            </button>
          )
        )}
        <button type="button" className="gt-pager-btn" onClick={() => onPage(page + 1)}
          disabled={loading || page >= pages - 1} aria-label="Next page">
          Next <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
