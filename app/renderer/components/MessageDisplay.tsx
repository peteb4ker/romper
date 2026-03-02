import { Toaster } from "sonner";

// Sonner handles notification display globally. This component just renders the Toaster.
const MessageDisplay = () => (
  <Toaster
    closeButton
    position="top-center"
    richColors
    toastOptions={{
      className: "!bg-surface-2 !text-text-primary !border-border-subtle",
    }}
  />
);

export default MessageDisplay;
