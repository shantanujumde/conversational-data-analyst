/** Shown while an answer is on its way: a print head runs along the empty line. */
export function PrintingLine() {
  return (
    <div role="status" className="flex flex-col gap-2 pt-1">
      <div className="relative h-[3px] w-full max-w-[420px] overflow-hidden bg-rule/60">
        <div className="print-head absolute inset-y-0 w-12 bg-cover" />
      </div>
      <span className="text-[13px] text-ink-soft">Printing…</span>
    </div>
  );
}
