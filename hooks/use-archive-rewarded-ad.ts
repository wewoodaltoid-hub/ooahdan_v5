import { useCallback, useRef, useState } from 'react';

type PendingAction = () => void | Promise<void>;

export type ArchiveRewardedAdConfig = {
  title: string;
  message: string;
};

/**
 * 광고 시청 완료 후에만 후속 동작 실행 (다운로드 등)
 */
export function useArchiveRewardedAd() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ArchiveRewardedAdConfig>({
    title: '광고 시청',
    message: '',
  });
  const pendingRef = useRef<PendingAction | null>(null);

  const dismissAdModal = useCallback(() => {
    setVisible(false);
    pendingRef.current = null;
  }, []);

  const completeAd = useCallback(async () => {
    setVisible(false);
    const action = pendingRef.current;
    pendingRef.current = null;
    if (action) await action();
  }, []);

  const requestAfterAd = useCallback(
    async (adConfig: ArchiveRewardedAdConfig, action: PendingAction): Promise<void> => {
      pendingRef.current = action;
      setConfig(adConfig);
      setVisible(true);
    },
    [],
  );

  return {
    visible,
    config,
    requestAfterAd,
    completeAd,
    dismissAdModal,
  };
}
