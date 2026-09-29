'use client';

import { useEffect } from 'react';

interface MaxBackButtonApi {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export function MaxBridgeBackButton({
  visible,
  onBack,
}: {
  visible: boolean;
  onBack: () => void;
}) {
  useEffect(() => {
    const button = (window as Window & { WebApp?: { BackButton?: MaxBackButtonApi } }).WebApp?.BackButton;
    if (!button) return;

    if (!visible) {
      button.hide();
      return;
    }

    button.show();
    button.onClick(onBack);
    return () => {
      button.offClick(onBack);
      button.hide();
    };
  }, [visible, onBack]);

  return null;
}
