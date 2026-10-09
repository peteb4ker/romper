import type {
  RampleKitSaveFound,
  RampleKitSaveView,
  RampleSaveCopyInfo,
} from "@romper/shared/rampleKitSaveView";
import type { RampleCvAssignment } from "@romper/shared/rampleSave";

import { CaretRightIcon } from "@phosphor-icons/react";
import React from "react";

import {
  firmwareRelease,
  formatRampleValue,
  formatTakenAt,
  RAMPLE_KIT_FIELDS,
  RAMPLE_KNOB_MAX,
  RAMPLE_KNOB_MIDDLE,
  RAMPLE_VOICES,
  type RampleVoiceFieldInfo,
  voiceRows,
} from "./rampleSaveFields";
import { RAMPLE_SAVE_TEXT as TEXT } from "./rampleSaveText";
import { type KitRampleSaveState, useKitRampleSave } from "./useKitRampleSave";

// Voice colors, after the Rample's livery (--voice-1..4). Whole class names,
// so Tailwind sees them.
const VOICE_TEXT = [
  "text-voice-1",
  "text-voice-2",
  "text-voice-3",
  "text-voice-4",
];
const VOICE_DOT = ["bg-voice-1", "bg-voice-2", "bg-voice-3", "bg-voice-4"];

const subheading =
  "mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary";
const note = "text-text-secondary";
const cell = "px-1.5 py-0.5 text-left font-normal";

/**
 * The kit editor's "On the Rample" section (#800, stage 3 of #786): what
 * the device saved for the kit when it was last STOREd, read from the
 * store's latest copy of the card's `_save` folder. Read-only, collapsed
 * by default, and read from main only while it's open. Values are raw
 * until hardware checks confirm what they mean.
 */
const RampleSavePanel: React.FC<{ kitName: string }> = ({ kitName }) => {
  const [open, setOpen] = React.useState(false);
  const state = useKitRampleSave(kitName, open);
  const id = React.useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  return (
    <section
      aria-labelledby={titleId}
      className="mt-3 mb-2 rounded-sm border border-border-subtle bg-surface-1"
      data-testid="rample-save-panel"
    >
      <h2 className="m-0 text-xs font-semibold" id={titleId}>
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-left text-text-primary hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          data-testid="rample-save-toggle"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          type="button"
        >
          <CaretRightIcon
            aria-hidden
            className={`text-text-tertiary transition-transform ${open ? "rotate-90" : ""}`}
            size={12}
            weight="bold"
          />
          {TEXT.title}
        </button>
      </h2>
      <div
        className="px-2.5 pb-2.5 text-xs text-text-primary"
        data-testid="rample-save-body"
        hidden={!open}
        id={bodyId}
      >
        {open && <PanelBody kitName={kitName} state={state} />}
      </div>
    </section>
  );
};

/** Where and when the values were read, and the firmware it points to */
const CopySource: React.FC<{
  copy: RampleSaveCopyInfo;
  view: RampleKitSaveView;
}> = ({ copy, view }) => {
  const release = firmwareRelease(view.firmware);
  return (
    <p className={note} data-testid="rample-save-source">
      <span>
        {copy.takenAt
          ? TEXT.readFrom(formatTakenAt(copy.takenAt))
          : TEXT.readFromUndated}
      </span>
      <span aria-hidden> · </span>
      <span data-testid="rample-save-firmware" title={TEXT.firmwareTooltip}>
        {release ? TEXT.firmware(release) : TEXT.firmwareUnknown}
      </span>
    </p>
  );
};

/** A value the file doesn't have: a dash, never a default */
const Missing: React.FC = () => (
  <span className="text-text-tertiary" title={TEXT.missingValueTooltip}>
    <span aria-hidden>{TEXT.missingValue}</span>
    <span className="sr-only">{TEXT.missingValueTooltip}</span>
  </span>
);

/** A field's name, marked as inferred until a hardware check confirms it */
const FieldName: React.FC<{
  check: number;
  inferred: boolean;
  label: string;
}> = ({ check, inferred, label }) =>
  inferred ? (
    <span
      className="border-b border-dotted border-text-tertiary"
      title={TEXT.inferredTooltip(check)}
    >
      {label}
      <span className="sr-only"> {TEXT.inferredSuffix}</span>
    </span>
  ) : (
    <span>{label}</span>
  );

/**
 * Where a knob value sits between 0 and 254, with the middle (127) marked.
 * Decoration: the number beside it is the value.
 */
const KnobGauge: React.FC<{ value: number; voice: number }> = ({
  value,
  voice,
}) => {
  const position = Math.min(value, RAMPLE_KNOB_MAX) / RAMPLE_KNOB_MAX;
  return (
    <span
      aria-hidden
      className="relative inline-block h-1.5 w-10 rounded-full bg-surface-3"
      title={TEXT.middleTooltip}
    >
      <span
        className="absolute -top-0.5 -bottom-0.5 w-px bg-text-tertiary"
        style={{ left: `${(RAMPLE_KNOB_MIDDLE / RAMPLE_KNOB_MAX) * 100}%` }}
      />
      <span
        className={`absolute top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${VOICE_DOT[voice - 1]}`}
        style={{ left: `${position * 100}%` }}
      />
    </span>
  );
};

/** What the section shows once it's open */
const PanelBody: React.FC<{ kitName: string; state: KitRampleSaveState }> = ({
  kitName,
  state,
}) => {
  switch (state.status) {
    case "error":
      return (
        <p className="text-accent-danger" data-testid="rample-save-error">
          {TEXT.loadError(state.error)}
        </p>
      );
    case "loaded":
      return <ViewBody kitName={kitName} view={state.view} />;
    default:
      return (
        <p className={note} role="status">
          {TEXT.loading}
        </p>
      );
  }
};

/** The kit's per-voice values, a field to a row and a voice to a column */
const VoiceTable: React.FC<{ found: RampleKitSaveFound }> = ({ found }) => (
  <table
    className="mt-2 border-collapse tabular-nums"
    data-testid="rample-save-voices"
  >
    <caption className="sr-only">{TEXT.voiceTableCaption}</caption>
    <thead>
      <tr>
        <td />
        {RAMPLE_VOICES.map((voice) => (
          <th
            className={`${cell} font-semibold ${VOICE_TEXT[voice - 1]}`}
            key={voice}
            scope="col"
          >
            {TEXT.voice(voice)}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {voiceRows(found.values).map(({ info, values }) => (
        <tr data-testid={`rample-save-row-${info.deviceKey}`} key={info.field}>
          <th className={`${cell} pr-3 text-text-secondary`} scope="row">
            <VoiceFieldName info={info} />
          </th>
          {values.map((value, i) => (
            <td className={cell} key={RAMPLE_VOICES[i]}>
              <VoiceValue knob={info.knob} value={value} voice={i + 1} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const VoiceFieldName: React.FC<{ info: RampleVoiceFieldInfo }> = ({ info }) => (
  <>
    <FieldName
      check={info.check}
      inferred={info.meaning === "inferred"}
      label={info.label}
    />
    <code className="ml-1.5 text-[10px] text-text-tertiary">
      {info.deviceKey}
    </code>
  </>
);

const VoiceValue: React.FC<{
  knob: boolean;
  value: number | undefined;
  voice: number;
}> = ({ knob, value, voice }) => {
  if (value === undefined) return <Missing />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-7 text-right">{value}</span>
      {knob && <KnobGauge value={value} voice={voice} />}
    </span>
  );
};

/** Which voice mutes which: 4 rows of 4 raw booleans */
const MuteGroups: React.FC<{ rows: boolean[][] | undefined }> = ({ rows }) => (
  <>
    <h3 className={subheading}>
      <FieldName
        check={RAMPLE_KIT_FIELDS.muteGroup.check}
        inferred={RAMPLE_KIT_FIELDS.muteGroup.meaning === "inferred"}
        label={TEXT.muteGroupsTitle}
      />
    </h3>
    <p className={note}>{TEXT.muteGroupsNote}</p>
    {rows ? (
      <table className="mt-1 border-collapse" data-testid="rample-save-mutes">
        <thead>
          <tr>
            <td />
            {RAMPLE_VOICES.map((voice) => (
              <th
                className={`${cell} font-semibold ${VOICE_TEXT[voice - 1]}`}
                key={voice}
                scope="col"
              >
                {voice}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={RAMPLE_VOICES[r] ?? r}>
              <th
                className={`${cell} font-semibold ${VOICE_TEXT[r] ?? ""}`}
                scope="row"
              >
                {r + 1}
              </th>
              {row.map((on, c) => (
                <td
                  className={`${cell} text-center`}
                  key={RAMPLE_VOICES[c] ?? c}
                  title={TEXT.muteCell(r + 1, c + 1, on)}
                >
                  <span aria-hidden>{on ? "●" : "○"}</span>
                  <span className="sr-only">{String(on)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <Missing />
    )}
  </>
);

/** The kit's CV assignments, CV1-CV4, as `{param, voice}` raw numbers */
const CvAssignments: React.FC<{
  assignments: RampleCvAssignment[] | undefined;
}> = ({ assignments }) => (
  <>
    <h3 className={subheading}>
      <FieldName
        check={RAMPLE_KIT_FIELDS.assignments.check}
        inferred={RAMPLE_KIT_FIELDS.assignments.meaning === "inferred"}
        label={TEXT.cvAssignmentsTitle}
      />
    </h3>
    <p className={note}>{TEXT.cvAssignmentsNote}</p>
    {assignments ? (
      <table
        className="mt-1 border-collapse tabular-nums"
        data-testid="rample-save-cv"
      >
        <thead>
          <tr>
            <td />
            <th className={cell} scope="col">
              <code>param</code>
            </th>
            <th className={cell} scope="col">
              <code>voice</code>
            </th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment, i) => (
            <tr key={TEXT.cvInput(i + 1)}>
              <th className={`${cell} text-text-secondary`} scope="row">
                {TEXT.cvInput(i + 1)}
              </th>
              <td className={cell}>{assignment.param ?? <Missing />}</td>
              <td className={cell}>{assignment.voice ?? <Missing />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <Missing />
    )}
  </>
);

/** Keys Romper doesn't know, and odd shapes: shown, never hidden */
const OtherValues: React.FC<{ found: RampleKitSaveFound }> = ({ found }) =>
  found.otherValues.length === 0 ? null : (
    <>
      <h3 className={subheading}>{TEXT.otherValuesTitle}</h3>
      <p className={note}>{TEXT.otherValuesNote}</p>
      <dl className="mt-1" data-testid="rample-save-other">
        {found.otherValues.map(({ key, unexpectedShape, value }) => (
          <div className="flex gap-2" key={key}>
            <dt>
              <code>{key}</code>
              {unexpectedShape && (
                <span className="ml-1 text-accent-warning">
                  ({TEXT.otherValueUnexpected})
                </span>
              )}
            </dt>
            <dd className="m-0">
              <code className="break-all">{formatRampleValue(value)}</code>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );

/** The section's contents for what main found */
const ViewBody: React.FC<{ kitName: string; view: RampleKitSaveView }> = ({
  kitName,
  view,
}) => {
  switch (view.status) {
    case "found":
      return (
        <div data-testid="rample-save-found">
          <CopySource copy={view.copy} view={view} />
          <p className={`${note} mt-1`}>{TEXT.rawValuesNote}</p>
          <VoiceTable found={view} />
          <MuteGroups rows={view.values.muteGroup} />
          <CvAssignments assignments={view.values.assignments} />
          <OtherValues found={view} />
          {view.missingKeys.length > 0 && (
            <p className={`${note} mt-3`} data-testid="rample-save-missing">
              {TEXT.missingKeys(view.missingKeys.join(", "))}
            </p>
          )}
        </div>
      );
    case "noCopy":
      return (
        <p className={note} data-testid="rample-save-no-copy">
          {TEXT.noCopy}
        </p>
      );
    case "noFile":
      return (
        <div data-testid="rample-save-no-file">
          <CopySource copy={view.copy} view={view} />
          <p className="mt-1">{TEXT.noFile(kitName)}</p>
        </div>
      );
    default:
      return (
        <div data-testid="rample-save-unreadable">
          <CopySource copy={view.copy} view={view} />
          <p className="mt-1 text-accent-danger">{TEXT.unreadable(kitName)}</p>
          <p className={`${note} mt-0.5 font-mono`}>
            {TEXT.unreadableDetail(view.fileName, view.reason)}
          </p>
        </div>
      );
  }
};

export default RampleSavePanel;
