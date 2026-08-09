import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Auth from "@/pages/Auth";

const invoke = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const submitLogin = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("Auth — sign in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue({ data: null, error: null });
    signInWithPassword.mockResolvedValue({ error: null });
  });

  // Regression: the client sent { password } while supabase/functions/guest-login
  // destructures { token }, so the magic-word guest login returned 403 on every
  // attempt and silently never worked. The field name is the contract.
  it("sends the guest-login field the edge function actually reads", async () => {
    render(<Auth />);
    submitLogin("a@b.c", "magic-word");

    await waitFor(() => expect(invoke).toHaveBeenCalled());

    const [fnName, options] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fnName).toBe("guest-login");
    expect(options.body).toHaveProperty("token", "magic-word");
    expect(options.body).not.toHaveProperty("password");
  });

  it("falls through to normal sign-in when guest-login does not match", async () => {
    render(<Auth />);
    submitLogin("a@b.c", "not-the-magic-word");

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "a@b.c",
        password: "not-the-magic-word",
      })
    );
  });

  // guest-login throwing must never block a real user from signing in.
  it("still signs in normally when guest-login rejects", async () => {
    invoke.mockRejectedValue(new Error("boom"));

    render(<Auth />);
    submitLogin("a@b.c", "pw123456");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
  });
});
