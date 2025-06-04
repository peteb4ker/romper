import { Toaster } from 'sonner';

// Sonner handles notification display globally. This component just renders the Toaster.
const MessageDisplay = () => <Toaster position="top-center" richColors closeButton />;

export default MessageDisplay;
