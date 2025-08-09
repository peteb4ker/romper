import React from "react";

import { useMessageDisplay } from "./hooks/shared/useMessageDisplay";

export const MessageDisplayContext = React.createContext<null | ReturnType<
  typeof useMessageDisplay
>>(null);
