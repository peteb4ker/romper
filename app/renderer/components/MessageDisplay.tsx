import { Toaster } from "sonner";

// Sonner handles notification display globally. This component just renders the Toaster.
const MessageDisplay = () => (
  <Toaster closeButton position="top-center" richColors />
);

export default MessageDisplay;
