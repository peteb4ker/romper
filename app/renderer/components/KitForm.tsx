import type { Kit } from "@romper/shared/db/schema";

import React from "react";

export interface KitFormProps {
  error?: null | string;
  kit: Kit | null;
  loading?: boolean;
  onSave: (alias: string, description: string, tags: string[]) => void;
  tagsEditable?: boolean;
}

const KitForm: React.FC<KitFormProps> = ({
  error,
  kit,
  loading,
  onSave,
  tagsEditable,
}) => {
  const [tags, setTags] = React.useState<string[]>([]);
  const [editingTags, setEditingTags] = React.useState(false);
  const [tagInput, setTagInput] = React.useState("");

  React.useEffect(() => {
    setTags([]); // Tags not currently in schema
  }, [kit]);

  if (loading)
    return (
      <div className="text-xs text-text-tertiary">Loading kit metadata...</div>
    );
  if (error) return <div className="text-xs text-accent-danger">{error}</div>;

  // Only show tags UI
  return (
    <div className="mb-4">
      {tagsEditable && (
        <div className="flex flex-wrap gap-1 items-center">
          {editingTags ? (
            <>
              {tags.map((tag, idx) => (
                <span
                  className="bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                  key={tag}
                >
                  {tag}
                  <button
                    className="ml-1 text-xs text-accent-danger hover:text-accent-danger/80"
                    onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                    title="Remove tag"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                autoFocus
                className="border-b border-accent-primary bg-transparent text-xs text-accent-primary focus:outline-none px-1 w-20"
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
                value={tagInput}
              />
              <button
                className="ml-2 px-2 py-0.5 bg-accent-primary text-white rounded text-xs"
                onClick={() => {
                  setEditingTags(false);
                  onSave(kit?.alias || "", "", tags);
                }}
                type="button"
              >
                Save
              </button>
              <button
                className="ml-1 px-2 py-0.5 bg-surface-3 text-text-primary rounded text-xs"
                onClick={() => {
                  setEditingTags(false);
                  setTags([]); // Tags not currently in schema
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
                    className="bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full text-xs"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="italic text-text-tertiary text-xs">
                  No tags
                </span>
              )}
              <button
                className="ml-2 px-2 py-0.5 bg-accent-primary text-white rounded text-xs"
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

export default KitForm;
