'use client';

import { Theme } from '@twilio-paste/core/theme';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Theme.Provider theme="default">
      {children}
    </Theme.Provider>
  );
}
