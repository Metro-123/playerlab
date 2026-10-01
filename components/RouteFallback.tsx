export function PageFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-[70vh] place-items-center pt-12">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border border-line" />
          <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-a" />
        </div>
        <p className="label-xs">{label}</p>
      </div>
    </div>
  );
}
