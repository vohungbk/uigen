import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: "call" | "result" = "call"
): ToolInvocation {
  return {
    toolCallId: "test-id",
    toolName,
    args,
    state,
    ...(state === "result" ? { result: "ok" } : {}),
  } as ToolInvocation;
}

// str_replace_editor labels

test("shows 'Creating <filename>' for str_replace_editor create", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "src/Button.tsx" })} />);
  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});

test("shows 'Editing <filename>' for str_replace_editor str_replace", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "str_replace", path: "src/Button.tsx" })} />);
  expect(screen.getByText("Editing Button.tsx")).toBeDefined();
});

test("shows 'Editing <filename>' for str_replace_editor insert", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "insert", path: "src/App.tsx" })} />);
  expect(screen.getByText("Editing App.tsx")).toBeDefined();
});

test("shows 'Reading <filename>' for str_replace_editor view", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "view", path: "src/index.ts" })} />);
  expect(screen.getByText("Reading index.ts")).toBeDefined();
});

test("shows 'Reverting <filename>' for str_replace_editor undo_edit", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "undo_edit", path: "src/Card.tsx" })} />);
  expect(screen.getByText("Reverting Card.tsx")).toBeDefined();
});

// file_manager labels

test("shows 'Renaming <from> → <to>' for file_manager rename", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeInvocation("file_manager", {
        command: "rename",
        path: "src/Old.tsx",
        new_path: "src/New.tsx",
      })}
    />
  );
  expect(screen.getByText("Renaming Old.tsx → New.tsx")).toBeDefined();
});

test("shows 'Deleting <filename>' for file_manager delete", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("file_manager", { command: "delete", path: "src/Unused.tsx" })} />);
  expect(screen.getByText("Deleting Unused.tsx")).toBeDefined();
});

// Fallback

test("falls back to tool name for unknown tool", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("unknown_tool", {})} />);
  expect(screen.getByText("unknown_tool")).toBeDefined();
});

test("falls back to generic label when path is missing", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create" })} />);
  expect(screen.getByText("Creating file")).toBeDefined();
});

// State-based icon

test("shows spinner when state is call", () => {
  const { container } = render(
    <ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "src/A.tsx" }, "call")} />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows green dot when state is result", () => {
  const { container } = render(
    <ToolCallBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "src/A.tsx" }, "result")} />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
