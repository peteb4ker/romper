import { useState } from 'react';

export function useKitPlanActions(sdCardPath: string, kitName: string, onPlanChanged?: () => void) {
    const [planActionStatus, setPlanActionStatus] = useState<string | null>(null);

    const handleCommitPlan = async () => {
        setPlanActionStatus(null);
        try {
            // @ts-ignore
            const result = await window.electronAPI.commitKitPlan(sdCardPath, kitName);
            if (result && result.success) {
                setPlanActionStatus('Plan committed successfully.');
                if (onPlanChanged) onPlanChanged();
            } else if (result && result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                setPlanActionStatus('Failed to commit plan:\n' + result.errors.join('\n'));
            } else {
                setPlanActionStatus('Failed to commit plan.');
            }
        } catch (e: any) {
            setPlanActionStatus('Error committing plan: ' + (e && e.message ? e.message : String(e)));
        }
    };
    const handleDiscardPlan = async () => {
        setPlanActionStatus(null);
        try {
            // @ts-ignore
            const result = await window.electronAPI.discardKitPlan(sdCardPath, kitName);
            if (result && result.success) {
                setPlanActionStatus('Plan changes discarded.');
                if (onPlanChanged) onPlanChanged();
            } else if (result && result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                setPlanActionStatus('Failed to discard plan:\n' + result.errors.join('\n'));
            } else {
                setPlanActionStatus('Failed to discard plan.');
            }
        } catch (e: any) {
            setPlanActionStatus('Error discarding plan: ' + (e && e.message ? e.message : String(e)));
        }
    };

    return { planActionStatus, handleCommitPlan, handleDiscardPlan };
}
