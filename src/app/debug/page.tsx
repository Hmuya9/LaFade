export default function Debug() {
  return (
    <div className="min-h-[80vh] grid place-items-center p-10">
      <div className="w-full max-w-xl space-y-6 rounded-2xl p-8 shadow-xl bg-white border border-dashed border-amber-500">
        <h1 className="text-3xl font-bold">Tailwind v4 Debug</h1>

        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-zinc-900 rounded-lg"></div>
          <div className="h-16 bg-amber-500 rounded-lg"></div>
          <div className="h-16 bg-green-500 rounded-lg"></div>
        </div>

        <button className="px-6 py-3 rounded-xl bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition">
          If you can see styles, Tailwind is working
        </button>

        <p className="text-zinc-600">
          If this page looks like unstyled text, Tailwind isn’t running.
        </p>
      </div>
    </div>
  );
}




