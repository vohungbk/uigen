import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();

vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();

vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();

vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

describe("useAuth — initial state", () => {
  it("starts with isLoading false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  it("calls the signIn action with email and password", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("returns the action result", async () => {
    const actionResult = { success: false, error: "Invalid credentials" };
    mockSignInAction.mockResolvedValue(actionResult);
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signIn("user@example.com", "bad-pass");
    });

    expect(returned).toEqual(actionResult);
  });

  it("sets isLoading to true while the action is in-flight, then false after", async () => {
    let resolve!: (val: { success: boolean }) => void;
    mockSignInAction.mockReturnValue(
      new Promise<{ success: boolean }>(r => { resolve = r; })
    );

    const { result } = renderHook(() => useAuth());

    // Fire without awaiting so the pending promise keeps isLoading true
    act(() => { result.current.signIn("user@example.com", "pass"); });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => { resolve({ success: false }); });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false even when the action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.signIn("user@example.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  describe("on success — post sign-in routing", () => {
    it("redirects to anon project when anon work with messages exists", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [{ role: "user", content: "hello" }] })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    it("includes fileSystemData when creating anon project", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      const fileSystemData = { "/": {}, "/App.tsx": "content" };
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "build a button" }],
        fileSystemData,
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ data: fileSystemData })
      );
    });

    it("does not migrate anon work when messages array is empty", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-id");
    });

    it("redirects to existing most-recent project when no anon work", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "recent-id" }, { id: "older-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-id");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it("creates a new project and redirects when no anon work and no projects exist", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
    });

    it("does not redirect on failed sign-in", async () => {
      mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrong-pass");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it("does not clear anon work on failed sign-in", async () => {
      mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrong-pass");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
    });
  });
});

describe("signUp", () => {
  it("calls the signUp action with email and password", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "password123");
  });

  it("returns the action result", async () => {
    const actionResult = { success: false, error: "Email already registered" };
    mockSignUpAction.mockResolvedValue(actionResult);
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signUp("new@example.com", "password123");
    });

    expect(returned).toEqual(actionResult);
  });

  it("sets isLoading to true while the action is in-flight, then false after", async () => {
    let resolve!: (val: { success: boolean }) => void;
    mockSignUpAction.mockReturnValue(
      new Promise<{ success: boolean }>(r => { resolve = r; })
    );

    const { result } = renderHook(() => useAuth());

    act(() => { result.current.signUp("new@example.com", "password123"); });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => { resolve({ success: false }); });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false even when the action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.signUp("new@example.com", "pass");
      } catch {
        // expected
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  describe("on success — post sign-up routing", () => {
    it("migrates anon work after successful sign-up", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "make a button" }],
        fileSystemData: { "/": {} },
      });
      mockCreateProject.mockResolvedValue({ id: "migrated-id" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "make a button" }],
          data: { "/": {} },
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-id");
    });

    it("redirects to existing project when no anon work after sign-up", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "existing-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-id");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it("creates a new project when no anon work and no projects after sign-up", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "first-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });

    it("does not redirect on failed sign-up", async () => {
      mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });
});
