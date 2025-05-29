import { useState, useEffect, useRef, useCallback } from 'react';
import { getNextKitSlot, toCapitalCase } from '../kitUtils';

export function useKitBrowser({
  kits: externalKits,
  sdCardPath,
  onRefreshKits,
}) {
  const kits = externalKits || [];
  const [error, setError] = useState(null);
  const [sdCardWarning, setSdCardWarning] = useState(null);
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKitSlot, setNewKitSlot] = useState('');
  const [newKitError, setNewKitError] = useState(null);
  const [nextKitSlot, setNextKitSlot] = useState(null);
  const [duplicateKitSource, setDuplicateKitSource] = useState(null);
  const [duplicateKitDest, setDuplicateKitDest] = useState('');
  const [duplicateKitError, setDuplicateKitError] = useState(null);
  const [bankNames, setBankNames] = useState({});
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    setNextKitSlot(getNextKitSlot(kits));
  }, [kits]);

  const getBankNames = useCallback(async (sdCardPath) => {
    if (!sdCardPath) return {};
    try {
      // @ts-ignore
      const files = await window.electronAPI?.listFilesInRoot?.(sdCardPath);
      const rtfFiles = files.filter(f => /^[A-Z] - .+\.rtf$/i.test(f));
      const bankNames = {};
      for (const file of rtfFiles) {
        const match = /^([A-Z]) - (.+)\.rtf$/i.exec(file);
        if (match) {
          const bank = match[1].toUpperCase();
          const name = toCapitalCase(match[2]);
          bankNames[bank] = name;
        }
      }
      return bankNames;
    } catch (e) {}
    return {};
  }, []);

  useEffect(() => {
    (async () => {
      setBankNames(await getBankNames(sdCardPath));
    })();
  }, [sdCardPath, getBankNames]);

  const handleCreateKit = async () => {
    setNewKitError(null);
    if (!/^[A-Z][0-9]{1,2}$/.test(newKitSlot)) {
      setNewKitError('Invalid kit slot. Use format A0-Z99.');
      return;
    }
    if (!sdCardPath) return;
    try {
      // @ts-ignore
      await window.electronAPI?.createKit?.(sdCardPath, newKitSlot);
      setShowNewKit(false);
      setNewKitSlot('');
      if (onRefreshKits) onRefreshKits();
    } catch (err) {
      setNewKitError('Failed to create kit: ' + (err?.message || err));
    }
  };

  const handleCreateNextKit = async () => {
    setNewKitError(null);
    if (!nextKitSlot || !/^[A-Z][0-9]{1,2}$/.test(nextKitSlot)) {
      setNewKitError('No next kit slot available.');
      return;
    }
    if (!sdCardPath) return;
    try {
      // @ts-ignore
      await window.electronAPI?.createKit?.(sdCardPath, nextKitSlot);
      if (onRefreshKits) onRefreshKits();
    } catch (err) {
      setNewKitError('Failed to create kit: ' + (err?.message || err));
    }
  };

  const handleDuplicateKit = async () => {
    setDuplicateKitError(null);
    if (!duplicateKitSource || !/^[A-Z][0-9]{1,2}$/.test(duplicateKitDest)) {
      setDuplicateKitError('Invalid destination slot. Use format A0-Z99.');
      return;
    }
    if (!sdCardPath) return;
    try {
      // @ts-ignore
      await window.electronAPI?.copyKit?.(sdCardPath, duplicateKitSource, duplicateKitDest);
      setDuplicateKitSource(null);
      setDuplicateKitDest('');
      if (onRefreshKits) onRefreshKits();
    } catch (err) {
      let msg = String(err?.message || err);
      msg = msg.replace(/^Error invoking remote method 'copy-kit':\s*/, '').replace(/^Error:\s*/, '');
      setDuplicateKitError(msg);
    }
  };

  const handleBankClick = (bank) => {
    const el = document.getElementById(`bank-${bank}`);
    if (el && scrollContainerRef.current) {
      const header = document.querySelector('.sticky.top-0');
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top - headerHeight - 8;
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollTop + offset, behavior: 'smooth' });
    }
  };

  const handleSelectSdCard = async () => {
    const selected = await window.electronAPI.selectSdCard();
    if (selected) {
      window.electronAPI.setSetting('sdCardPath', selected);
    }
  };

  return {
    kits,
    error,
    setError,
    sdCardWarning,
    setSdCardWarning,
    showNewKit,
    setShowNewKit,
    newKitSlot,
    setNewKitSlot,
    newKitError,
    setNewKitError,
    nextKitSlot,
    setNextKitSlot,
    duplicateKitSource,
    setDuplicateKitSource,
    duplicateKitDest,
    setDuplicateKitDest,
    duplicateKitError,
    setDuplicateKitError,
    bankNames,
    setBankNames,
    scrollContainerRef,
    handleCreateKit,
    handleCreateNextKit,
    handleDuplicateKit,
    handleBankClick,
    handleSelectSdCard,
  };
}
