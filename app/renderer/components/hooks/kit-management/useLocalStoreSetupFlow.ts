import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";

import { useCallback, useEffect, useState } from "react";

interface ImportMetaEnv {
  env: {
    MODE?: string;
    VITE_ROMPER_TEST_MODE?: string;
  };
}

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
  // Determine local store configuration state according to requirements
  // A1-A3: No local store configured - show setup wizard
  // Also includes test environment overrides with invalid paths (for wizard tests)
  const isTestEnvironment =
    (import.meta as unknown as ImportMetaEnv).env.MODE === "test" ||
    (import.meta as unknown as ImportMetaEnv).env.VITE_ROMPER_TEST_MODE ===
      "true";
  const isEnvironmentOverride =
    localStoreStatus?.isEnvironmentOverride || false;
  const needsLocalStoreSetup =
    isInitialized &&
    localStoreStatus !== null &&
    (!localStoreStatus.hasLocalStore ||
      (isTestEnvironment &&
        isEnvironmentOverride &&
        !localStoreStatus.isValid));

  // C1-C6: Local store configured but invalid - show modal blocking error dialog
  // Exception: In test environment with env override, don't block - let tests proceed
  const hasInvalidLocalStore =
    isInitialized &&
    localStoreStatus !== null &&
    Boolean(localStoreStatus.hasLocalStore) &&
    !localStoreStatus.isValid &&
    !(isTestEnvironment && isEnvironmentOverride);

  // Critical environment variable error - should close app
  const hasCriticalEnvironmentError = Boolean(
    localStoreStatus?.isCriticalEnvironmentError,
  );

  // D: Environment variable override - show test mode banner
  const [showEnvironmentBanner, setShowEnvironmentBanner] = useState(false);

  useEffect(() => {
    if (isEnvironmentOverride) {
      setShowEnvironmentBanner(true);
    }
  }, [isEnvironmentOverride]);

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
  useEffect(() => {
    if (!needsLocalStoreSetup && wizardJustCompleted) {
      setWizardJustCompleted(false);
    }
  }, [needsLocalStoreSetup, wizardJustCompleted]);

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
    isTestEnvironment,
    isWizardInitializing,
    needsLocalStoreSetup,
    setIsWizardInitializing,
    showEnvironmentBanner,
  };
}
