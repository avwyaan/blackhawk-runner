Deno.serve(() => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RunCart — Support</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 680px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 15px; margin-bottom: 40px; }
    h2 { font-size: 18px; margin-top: 36px; }
    p, li { font-size: 15px; color: #333; }
    ul { padding-left: 20px; }
    a { color: #2563eb; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px 28px; margin-top: 32px; }
  </style>
</head>
<body>
  <h1>RunCart Support</h1>
  <p class="sub">We're here to help.</p>

  <div class="card">
    <h2 style="margin-top:0">Contact Us</h2>
    <p>For any questions, issues, or feedback, email us at:<br>
    <a href="mailto:wygnesh@gmail.com"><strong>wygnesh@gmail.com</strong></a></p>
    <p>We aim to respond within 24 hours.</p>
  </div>

  <h2>Common Questions</h2>

  <h2 style="font-size:16px">How do I join a group?</h2>
  <p>RunCart is invite-only. Ask your group admin to send you an invite — you'll receive an email with your personal invite code. Open the app, tap <strong>Groups</strong>, then <strong>Join with Code</strong> and enter your code.</p>

  <h2 style="font-size:16px">How do I add items to a run?</h2>
  <p>When a runner starts a store run, you'll get a push notification. Tap it to open the run, then type your items and tap <strong>Submit Items</strong>. You can continue adding or editing items until the runner locks the list.</p>

  <h2 style="font-size:16px">I didn't receive a push notification.</h2>
  <p>Make sure notifications are enabled for RunCart in your iPhone's Settings → Notifications → RunCart. Also ensure you're a member of the group the run was created in.</p>

  <h2 style="font-size:16px">How do I delete my account?</h2>
  <p>Open RunCart, go to <strong>Profile</strong>, scroll to the bottom, and tap <strong>Delete Account</strong>. This permanently removes all your data immediately.</p>

  <h2 style="font-size:16px">I forgot my password.</h2>
  <p>On the sign-in screen, tap <strong>Forgot password?</strong> and enter your email. You'll receive a reset link.</p>

  <p style="margin-top:48px; font-size:13px; color:#999;">RunCart · <a href="https://dixtfwozrmeelrolxvwk.supabase.co/functions/v1/privacy-policy">Privacy Policy</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
