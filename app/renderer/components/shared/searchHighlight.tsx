import React from "react";

/**
 * Search-term highlighting helpers shared by kit browser items.
 */

export const stripExtension = (filename: string) =>
  filename.replace(/\.[^.]+$/, "");

export const highlightMatch = (
  text: string,
  term: string,
  markClass = "bg-accent-primary/25 text-accent-primary",
) => {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={`${markClass} font-semibold rounded-sm px-0.5`}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
};
