import React from "react";

export interface ToastMessage { id: number; text: string; tone: "ok" | "error" }

const Toasts: React.FC<{ toasts: ToastMessage[] }> = ({ toasts }) => (
  <div className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`anim-pop max-w-sm rounded-full px-4 py-2.5 text-sm shadow-lg ${
          toast.tone === "error" ? "bg-over text-bg" : "bg-ink text-bg"
        }`}
      >
        {toast.text}
      </div>
    ))}
  </div>
);

export default Toasts;

/** Minimal toast queue: each message disappears on its own. */
export const useToasts = () => {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const show = React.useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), tone === "error" ? 4500 : 2200);
  }, []);
  return { toasts, show };
};
