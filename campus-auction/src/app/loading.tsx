export default function Loading() {
  return (
    <div className="page-container">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
            <div className="skeleton h-48 w-full" />
            <div className="p-5 space-y-3">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="flex justify-between mt-4">
                <div className="skeleton h-8 w-24 rounded-lg" />
                <div className="skeleton h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
