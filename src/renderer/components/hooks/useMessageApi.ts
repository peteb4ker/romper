// This hook provides access to the Sonner-based message API via context.
import { useContext } from 'react';
import { MessageDisplayContext } from '../__tests__/MockMessageDisplayContext';

export function useMessageApi() {
  const ctx = useContext(MessageDisplayContext);
  if (!ctx) throw new Error('useMessageApi must be used within MessageDisplayContext');
  return ctx;
}
