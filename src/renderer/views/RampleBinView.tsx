import React, { useEffect, useState } from 'react';

interface RampleBinData {
  header: {
    magic: string;
    version: number;
    reserved: number[];
  };
  kitAssignments: number[];
  globalSettings: number[];
  fileSize: number;
}

interface RampleBinViewProps {
  sdCardPath: string | null;
}

const formatHex = (arr: number[] | Buffer) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');

const RampleBinView: React.FC<RampleBinViewProps> = ({ sdCardPath }) => {
  const [data, setData] = useState<RampleBinData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sdCardPath) {
      setData(null);
      return;
    }
    // @ts-ignore
    window.electronAPI.readRampleBinAll?.(`${sdCardPath}/rample.bin`).then(setData).catch(e => setError(e.message.includes('no such file') ? 'rample.bin not found on SD card.' : e.message));
  }, [sdCardPath]);

  if (!sdCardPath) return <div className="p-4">No SD card selected.</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return <div className="p-4">Loading rample.bin...</div>;
  // Defensive: check for missing or malformed data
  if (typeof data.fileSize !== 'number' || !data.header || !data.kitAssignments || !data.globalSettings) {
    return <div className="p-4 text-red-500">Malformed rample.bin data.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">rample.bin Contents</h2>
      <table className="table-auto border-collapse w-full text-xs">
        <tbody>
          <tr className="border-b"><th className="text-left pr-2">Header</th><td className="font-mono">Magic: {data.header.magic}, Version: {data.header.version}, Reserved: {data.header.reserved.join(' ')}</td></tr>
          <tr className="border-b"><th className="text-left pr-2 align-top">Kit Assignments</th>
            <td>
              <div className="overflow-x-auto">
                <table className="border-collapse">
                  <thead><tr>{[...Array(10)].map((_,i) => <th key={i} className="px-1">{i*10}-{i*10+9}</th>)}</tr></thead>
                  <tbody>
                    {[0,1,2,3].map(bank => (
                      <tr key={bank}>
                        {[...Array(10)].map((_,col) => (
                          <td key={col} className="px-1 font-mono">
                            {data.kitAssignments.slice(bank*100+col*10, bank*100+col*10+10).map((v,idx) => v === 255 ? '--' : v.toString().padStart(2,'0')).join(' ')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
          <tr className="border-b"><th className="text-left pr-2">Global Settings</th><td className="font-mono">{data.globalSettings.map(b => b.toString(16).padStart(2, '0')).join(' ')}</td></tr>
          <tr><th className="text-left pr-2">File Size</th><td>{data.fileSize} bytes</td></tr>
        </tbody>
      </table>
      <RampleLabelsSection sdCardPath={sdCardPath} />
    </div>
  );
};

const RampleLabelsSection: React.FC<{ sdCardPath: string | null }> = ({ sdCardPath }) => {
  const [labels, setLabels] = useState<RampleLabels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<RampleLabels | null>(null);

  useEffect(() => {
    if (!sdCardPath) return;
    // @ts-ignore
    window.electronAPI.readRampleLabels(sdCardPath).then(setLabels).catch(e => setError(e.message));
  }, [sdCardPath, editing]);

  if (!sdCardPath) return null;
  if (error) return <div className="p-2 text-red-500">{error}</div>;
  if (!labels) return <div className="p-2">No .rample_labels.json found.</div>;

  const handleEdit = () => {
    setEditData(JSON.parse(JSON.stringify(labels)));
    setEditing(true);
  };
  const handleCancel = () => setEditing(false);
  const handleSave = async () => {
    if (!sdCardPath || !editData) return;
    // @ts-ignore
    await window.electronAPI.writeRampleLabels(sdCardPath, editData);
    setEditing(false);
  };
  const handleFieldChange = (kit: string, field: keyof RampleKitLabel, value: string | string[]) => {
    if (!editData) return;
    setEditData({
      ...editData,
      kits: {
        ...editData.kits,
        [kit]: {
          ...editData.kits[kit],
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="mt-6">
      <h3 className="font-bold mb-2">Kit Metadata (.rample_labels.json)</h3>
      {!editing ? (
        <>
          <table className="table-auto border-collapse w-full text-xs mb-2">
            <thead>
              <tr>
                <th className="text-left px-2">Kit Folder</th>
                <th className="text-left px-2">Label</th>
                <th className="text-left px-2">Description</th>
                <th className="text-left px-2">Tags</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(labels.kits).map(([kit, meta]) => (
                <tr key={kit}>
                  <td className="px-2 font-mono">{kit}</td>
                  <td className="px-2">{meta.label}</td>
                  <td className="px-2">{meta.description || ''}</td>
                  <td className="px-2">{meta.tags?.join(', ') || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs" onClick={handleEdit}>Edit Metadata</button>
        </>
      ) : (
        <>
          <table className="table-auto border-collapse w-full text-xs mb-2">
            <thead>
              <tr>
                <th className="text-left px-2">Kit Folder</th>
                <th className="text-left px-2">Label</th>
                <th className="text-left px-2">Description</th>
                <th className="text-left px-2">Tags</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(editData!.kits).map(([kit, meta]) => (
                <tr key={kit}>
                  <td className="px-2 font-mono">{kit}</td>
                  <td className="px-2"><input className="border rounded px-1 w-32" value={meta.label} onChange={e => handleFieldChange(kit, 'label', e.target.value)} /></td>
                  <td className="px-2"><input className="border rounded px-1 w-48" value={meta.description || ''} onChange={e => handleFieldChange(kit, 'description', e.target.value)} /></td>
                  <td className="px-2"><input className="border rounded px-1 w-32" value={meta.tags?.join(', ') || ''} onChange={e => handleFieldChange(kit, 'tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="px-2 py-1 bg-green-600 text-white rounded text-xs mr-2" onClick={handleSave}>Save</button>
          <button className="px-2 py-1 bg-gray-400 text-white rounded text-xs" onClick={handleCancel}>Cancel</button>
        </>
      )}
    </div>
  );
};

export interface RampleKitLabel {
  label: string;
  description?: string;
  tags?: string[];
}

export interface RampleLabels {
  kits: Record<string, RampleKitLabel>;
}

export default RampleBinView;
