import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const getSession = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => onAuthStateChange(),
      signOut: vi.fn(),
    },
  },
}));

function Probe() {
  const { loading, user } = useAuth();
  return <div data-testid="state">{loading ? "loading" : user ? "user" : "anon"}</div>;
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  // Regression: App Review rejection 2026-07-30 (Guideline 2.1a). The Supabase
  // project was paused, getSession() rejected with a network error, nothing
  // caught it, so `loading` stayed true and the app hung on the "Loading..."
  // gate forever instead of showing the auth screen.
  it("stops loading when the backend is unreachable", async () => {
    getSession.mockRejectedValue(new TypeError("Load failed"));

    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("anon")
    );
  });

  it("resolves to the session user when the backend is reachable", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.c" } } },
    });

    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("user")
    );
  });

  it("resolves to anonymous when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("anon")
    );
  });
});
