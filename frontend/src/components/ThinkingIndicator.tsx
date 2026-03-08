export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
    </div>
  );
}
