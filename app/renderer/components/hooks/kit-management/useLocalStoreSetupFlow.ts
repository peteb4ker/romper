import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";

import { useCallback, useEffect, useState } from "react";

interface UseLocalStoreSetupFlowParams {
  closeWizard: () => void;
  isInitialized: boolean;
  localStoreStatus: LocalStoreValidationDetailedResult | null;
  refreshLocalStoreStatus: () => Promise<void>;
  setShowWizard: (show: boolean) => void;
}

/**
 * Local store configuration gate for the kits view.
 *
 * Derives the setup-scenario flags from the validation status:
 * - A1-A3: no local store configured — auto-open the setup wizard
 * - C1-C6: local store configured but invalid — blocking error dialog
 * - critical environment-variable error — app must close
 * - D: environment override — dismissible test-mode banner
 * - ready: the store is there and valid, so kits load and banks scan
 *
 * Also owns the wizard lifecycle around those flags (auto-trigger,
 * just-completed suppression, initialization-in-progress) and the
 * success/critical-error handlers.
 */
export function useLocalStoreSetupFlow({
  closeWizard,
  isInitialized,
  localStoreStatus,
  refreshLocalStoreStatus,
  setShowWizard,
}: UseLocalStoreSetupFlowParams) {
  const isEnvironmentOverride =
    localStoreStatus?.isEnvironmentOverride || false;

  // A1-A3: No local store configured - show setup wizard
  const needsLocalStoreSetup =
    isInitialized &&
    localStoreStatus !== null &&
    !localStoreStatus.hasLocalStore;

  // C1-C6: Local store configured but invalid - show modal blocking error dialog
  const hasInvalidLocalStore =
    isInitialized &&
    localStoreStatus !== null &&
    Boolean(localStoreStatus.hasLocalStore) &&
    !localStoreStatus.isValid;

  // Critical environment variable error - should close app
  const hasCriticalEnvironmentError = Boolean(
    localStoreStatus?.isCriticalEnvironmentError,
  );

  // The store is there and valid, so it can be read. Until its status is
  // known (null) it is not: reading a store that's missing at launch
  // reports errors (#553).
  const isLocalStoreReady =
    isInitialized &&
    localStoreStatus !== null &&
    Boolean(localStoreStatus.hasLocalStore) &&
    localStoreStatus.isValid &&
    !hasCriticalEnvironmentError;

  // D: Environment variable override - show test mode banner
  // Shown again whenever the override comes on; dismissing it hides it
  const [showEnvironmentBanner, setShowEnvironmentBanner] = useState(
    isEnvironmentOverride,
  );
  const [bannerOverride, setBannerOverride] = useState(isEnvironmentOverride);
  if (bannerOverride !== isEnvironmentOverride) {
    setBannerOverride(isEnvironmentOverride);
    if (isEnvironmentOverride) setShowEnvironmentBanner(true);
  }

  // Track if we just completed the wizard to prevent re-opening
  const [wizardJustCompleted, setWizardJustCompleted] = useState(false);

  // Track wizard initialization state to suppress invalid store dialog
  const [isWizardInitializing, setIsWizardInitializing] = useState(false);

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup && !wizardJustCompleted) {
      setShowWizard(true);
    }
  }, [needsLocalStoreSetup, setShowWizard, wizardJustCompleted]);

  // Reset wizardJustCompleted when needsLocalStoreSetup becomes false
  if (!needsLocalStoreSetup && wizardJustCompleted) {
    setWizardJustCompleted(false);
  }

  // Wizard success handler
  const handleWizardSuccess = useCallback(async () => {
    setWizardJustCompleted(true);
    closeWizard();
    await refreshLocalStoreStatus();
  }, [closeWizard, refreshLocalStoreStatus]);

  // Critical error handler
  const handleCriticalError = useCallback(() => {
    if (globalThis.electronAPI?.closeApp) {
      void globalThis.electronAPI.closeApp();
    } else {
      // Fallback for development or if API is not available
      window.close();
    }
  }, []);

  return {
    dismissEnvironmentBanner: () => setShowEnvironmentBanner(false),
    handleCriticalError,
    handleWizardSuccess,
    hasCriticalEnvironmentError,
    hasInvalidLocalStore,
    isEnvironmentOverride,
    isLocalStoreReady,
    isWizardInitializing,
    needsLocalStoreSetup,
    setIsWizardInitializing,
    showEnvironmentBanner,
  };
}
