/** The passbook cover: a slim green band with the product name and nothing else. */
export function TopBand() {
  return (
    <header className="bg-cover text-white shadow-[inset_0_-1px_0_rgb(255_255_255/0.12)]">
      <div className="mx-auto flex h-12 max-w-[960px] items-center px-4 sm:px-8">
        <h1 className="text-[15px] font-semibold tracking-[0.01em]">Conversational Data Analyst</h1>
      </div>
    </header>
  );
}
