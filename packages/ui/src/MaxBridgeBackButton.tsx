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
    const webApp = (window as Window & { WebApp?: { initData?: string; BackButton?: MaxBackButtonApi } }).WebApp;
    // Loading the SDK in a regular browser does not provide a native transport.
    if (!webApp?.initData?.trim()) return;
    const button = webApp.BackButton;
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
