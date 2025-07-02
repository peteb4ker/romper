import React from "react";

interface StepSequencerDrawerProps {
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  children: React.ReactNode;
}

const StepSequencerDrawer: React.FC<StepSequencerDrawerProps> = ({
  sequencerOpen,
  setSequencerOpen,
  children,
}) => {
  return (
    <div
      className="relative w-full flex flex-col items-center"
      style={{ zIndex: 19, minHeight: "33px" }}
    >
      {/* Drawer handle/edge */}
      <button
        className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-36 h-6 border-b-0 rounded-t-sm bg-gray-300 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 shadow-md hover:bg-gray-400 dark:hover:bg-slate-600 transition-colors focus:outline-none pointer-events-auto ${sequencerOpen ? "-top-4" : "top-2"}`}
        style={{
          cursor: "pointer",
          transition: "top 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
        aria-label={
          sequencerOpen ? "Hide step sequencer" : "Show step sequencer"
        }
        data-testid="kit-step-sequencer-handle"
        onClick={() => setSequencerOpen(!sequencerOpen)}
      >
        <span className="w-6 h-1 rounded bg-gray-500 dark:bg-gray-300 block" />
        <span className="ml-2 text-xs font-semibold">
          {sequencerOpen ? "Hide" : "Show"} Sequencer
        </span>
      </button>

      {/* Drawer body with animation */}
      <div
        className={`transition-all duration-500 ease-in-out rounded-t-md overflow-hidden w-full flex justify-center pointer-events-auto ${sequencerOpen ? "max-h-[400px] opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-8 pointer-events-none"}`}
        style={{
          boxShadow: sequencerOpen
            ? "0 -4px 24px 0 rgba(0,0,0,0.18)"
            : undefined,
          background: "linear-gradient(180deg, #23272f 0%, #181a20 100%)",
          borderTop: "2px solid #8884",
          marginTop: sequencerOpen ? 8 : 0,
          position: "relative",
        }}
        data-testid="kit-step-sequencer-drawer"
      >
        <div
          className="mt-4 mb-4 w-full flex flex-col items-center"
          data-testid="kit-step-sequencer"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default StepSequencerDrawer;
