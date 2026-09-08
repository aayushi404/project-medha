"use client";

import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { useCopy } from "@/lib/copy";
import type { GenerationType } from "@/lib/generation-types";
import { cn } from "@/lib/utils";

/** Loosely-typed on purpose: one params object flows through the whole
 * create page as `Record<string, unknown>`, merged by `patch`. The backend
 * (PARAM_MODELS) is the source of truth for validation. */
export type ParamValue = Record<string, unknown>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-24"
      />
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border accent-terracotta"
      />
      <span className="font-medium text-muted-foreground">{label}</span>
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

export function ParamPanel({
  type,
  params,
  onPatch,
  disabled,
}: {
  type: GenerationType;
  params: ParamValue;
  onPatch: (patch: ParamValue) => void;
  disabled?: boolean;
}) {
  const copy = useCopy().generation.create.params;

  if (type === "lesson_plan") {
    return (
      <div className="flex flex-col gap-3">
        <Row>
          <NumberField
            label={copy.periods}
            value={Number(params.periods ?? 3)}
            min={1}
            max={8}
            disabled={disabled}
            onChange={(n) => onPatch({ periods: n })}
          />
        </Row>
        <Field label={copy.focus}>
          <textarea
            value={String(params.focus ?? "")}
            disabled={disabled}
            onChange={(e) => onPatch({ focus: e.target.value.slice(0, 500) })}
            placeholder={copy.focusPlaceholder}
            rows={2}
            className={cn(
              "resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus-visible:border-ring",
              disabled && "opacity-50",
            )}
          />
        </Field>
      </div>
    );
  }

  if (type === "presentation") {
    const detailOptions: SelectOption[] = [
      { value: "simple", label: copy.detailSimple },
      { value: "detailed", label: copy.detailDetailed },
    ];
    return (
      <div className="flex flex-col gap-3">
        <Row>
          <NumberField
            label={copy.slideCount}
            value={Number(params.slide_count ?? 8)}
            min={4}
            max={15}
            disabled={disabled}
            onChange={(n) => onPatch({ slide_count: n })}
          />
          <Field label={copy.detail}>
            <Select
              value={String(params.detail ?? "simple")}
              options={detailOptions}
              onValueChange={(v) => onPatch({ detail: v })}
              disabled={disabled}
            />
          </Field>
        </Row>
        <CheckboxField
          label={copy.includeNotes}
          checked={params.include_notes !== false}
          disabled={disabled}
          onChange={(v) => onPatch({ include_notes: v })}
        />
      </div>
    );
  }

  if (type === "question_paper") {
    return (
      <div className="flex flex-col gap-3">
        <Row>
          <NumberField
            label={copy.totalMarks}
            value={Number(params.total_marks ?? 20)}
            min={5}
            max={100}
            disabled={disabled}
            onChange={(n) => onPatch({ total_marks: n })}
          />
          <NumberField
            label={copy.durationMin}
            value={Number(params.duration_min ?? 40)}
            min={10}
            max={180}
            disabled={disabled}
            onChange={(n) => onPatch({ duration_min: n })}
          />
        </Row>
        <Row>
          <NumberField
            label={copy.mcqCount}
            value={Number(params.mcq_count ?? 5)}
            min={0}
            max={40}
            disabled={disabled}
            onChange={(n) => onPatch({ mcq_count: n })}
          />
          <NumberField
            label={copy.shortCount}
            value={Number(params.short_count ?? 3)}
            min={0}
            max={30}
            disabled={disabled}
            onChange={(n) => onPatch({ short_count: n })}
          />
          <NumberField
            label={copy.longCount}
            value={Number(params.long_count ?? 2)}
            min={0}
            max={15}
            disabled={disabled}
            onChange={(n) => onPatch({ long_count: n })}
          />
        </Row>
      </div>
    );
  }

  if (type === "quiz") {
    const difficultyOptions: SelectOption[] = [
      { value: "mixed", label: copy.difficultyMixed },
      { value: "easy", label: copy.difficultyEasy },
      { value: "medium", label: copy.difficultyMedium },
      { value: "hard", label: copy.difficultyHard },
    ];
    const types = (params.types as string[] | undefined) ?? ["mcq", "short", "truefalse"];
    function toggleType(t: string) {
      const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
      onPatch({ types: next.length ? next : types });
    }
    return (
      <div className="flex flex-col gap-3">
        <Row>
          <NumberField
            label={copy.questionCount}
            value={Number(params.question_count ?? 6)}
            min={3}
            max={20}
            disabled={disabled}
            onChange={(n) => onPatch({ question_count: n })}
          />
          <Field label={copy.difficulty}>
            <Select
              value={String(params.difficulty ?? "mixed")}
              options={difficultyOptions}
              onValueChange={(v) => onPatch({ difficulty: v })}
              disabled={disabled}
            />
          </Field>
        </Row>
        <Field label={copy.questionTypes}>
          <div className="flex flex-wrap gap-3 pt-0.5">
            <CheckboxField
              label={copy.typeMcq}
              checked={types.includes("mcq")}
              disabled={disabled}
              onChange={() => toggleType("mcq")}
            />
            <CheckboxField
              label={copy.typeShort}
              checked={types.includes("short")}
              disabled={disabled}
              onChange={() => toggleType("short")}
            />
            <CheckboxField
              label={copy.typeTruefalse}
              checked={types.includes("truefalse")}
              disabled={disabled}
              onChange={() => toggleType("truefalse")}
            />
          </div>
        </Field>
      </div>
    );
  }

  // notes
  const depthOptions: SelectOption[] = [
    { value: "summary", label: copy.depthSummary },
    { value: "standard", label: copy.depthStandard },
    { value: "detailed", label: copy.depthDetailed },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <Field label={copy.depth}>
          <Select
            value={String(params.depth ?? "standard")}
            options={depthOptions}
            onValueChange={(v) => onPatch({ depth: v })}
            disabled={disabled}
          />
        </Field>
      </Row>
      <CheckboxField
        label={copy.includeKeyTerms}
        checked={params.include_key_terms !== false}
        disabled={disabled}
        onChange={(v) => onPatch({ include_key_terms: v })}
      />
    </div>
  );
}
