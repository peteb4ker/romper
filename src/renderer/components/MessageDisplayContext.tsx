import React from 'react';

import { useMessageDisplay } from './hooks/useMessageDisplay';

export const MessageDisplayContext = React.createContext<ReturnType<typeof useMessageDisplay> | null>(null);
