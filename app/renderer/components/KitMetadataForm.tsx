import React, { useState } from "react";

export interface KitMetadataFormProps {
  kitLabel: {
    label: string;
    description?: string;
    tags?: string[];
  } | null;
  loading?: boolean;
  error?: string | null;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave: (label: string, description: string, tags: string[]) => void;
  hideDescription?: boolean;
  tagsEditable?: boolean;
}

const KitMetadataForm: React.FC<KitMetadataFormProps> = ({
  kitLabel,
  loading,
  error,
  editing = false,
  onEdit,
  onCancel,
  onSave,
  hideDescription,
  tagsEditable,
}) => {
  const [tags, setTags] = React.useState<string[]>(kitLabel?.tags || []);
  const [editingTags, setEditingTags] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");

  React.useEffect(() => {
    setTags(kitLabel?.tags || []);
  }, [kitLabel]);

  if (loading)
    return <div className="text-xs text-gray-400">Loading kit metadata...</div>;
  if (error) return <div className="text-xs text-red-500">{error}</div>;

  // Only show tags UI
  return (
    <div className="mb-4">
      {tagsEditable && (
        <div className="flex flex-wrap gap-1 items-center">
          {editingTags ? (
            <>
              {tags.map((tag, idx) => (
                <span
                  key={tag}
                  className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                >
                  {tag}
                  <button
                    className="ml-1 text-xs text-red-500 hover:text-red-700"
                    onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                    title="Remove tag"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="border-b border-blue-500 bg-transparent text-xs text-blue-900 dark:text-blue-100 focus:outline-none px-1 w-20"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    setTags([...tags, tagInput.trim()]);
                    setTagInput("");
                  } else if (e.key === "Escape") {
                    setEditingTags(false);
                    setTagInput("");
                  }
                }}
                placeholder="Add tag"
                autoFocus
              />
              <button
                className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded text-xs"
                onClick={() => {
                  setEditingTags(false);
                  onSave(kitLabel?.label || "", "", tags);
                }}
                type="button"
              >
                Save
              </button>
              <button
                className="ml-1 px-2 py-0.5 bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded text-xs"
                onClick={() => {
                  setEditingTags(false);
                  setTags(kitLabel?.tags || []);
                  setTagInput("");
                }}
                type="button"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="italic text-gray-400 text-xs">No tags</span>
              )}
              <button
                className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded text-xs"
                onClick={() => setEditingTags(true)}
                type="button"
              >
                Edit Tags
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default KitMetadataForm;
