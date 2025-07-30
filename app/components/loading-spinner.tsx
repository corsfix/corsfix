export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-screen flex-col">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-2"></div>
      <p>Loading dashboard...</p>
    </div>
  );
}