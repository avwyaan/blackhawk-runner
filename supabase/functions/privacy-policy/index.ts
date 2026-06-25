Deno.serve(() => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RunCart — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 680px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .updated { color: #666; font-size: 14px; margin-bottom: 40px; }
    h2 { font-size: 18px; margin-top: 36px; }
    p, li { font-size: 15px; color: #333; }
    ul { padding-left: 20px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: June 2026</p>

  <p>RunCart ("the app", "we", "us") is a private group coordination app that helps people share grocery and errand lists with a designated runner. This policy explains what data we collect, why, and how you can delete it.</p>

  <h2>What we collect</h2>
  <ul>
    <li><strong>Email address</strong> — used to create and identify your account.</li>
    <li><strong>Display name</strong> — shown to other members of your group.</li>
    <li><strong>Order items</strong> — the grocery or errand items you add to a run.</li>
    <li><strong>Device token</strong> — your device's push notification identifier, used to send you alerts when a run is started or items are updated.</li>
    <li><strong>Group membership</strong> — which group(s) you belong to within the app.</li>
  </ul>

  <h2>What we don't collect</h2>
  <ul>
    <li>Location data</li>
    <li>Contacts</li>
    <li>Payment information</li>
    <li>Usage analytics or advertising identifiers</li>
  </ul>

  <h2>How we use your data</h2>
  <p>All data collected is used solely to operate the app — coordinating store runs within your private group. We do not sell, share, or transfer your data to any third party, except Apple's Push Notification Service (APNs) which is used only to deliver in-app notifications to your device.</p>

  <h2>Data storage</h2>
  <p>Your data is stored securely on Supabase infrastructure (hosted on AWS). All connections are encrypted via HTTPS/TLS. We do not store passwords in plain text.</p>

  <h2>How to delete your account</h2>
  <p>You can permanently delete your account and all associated data directly from the app:</p>
  <ol>
    <li>Open RunCart and go to <strong>Profile</strong></li>
    <li>Scroll to the bottom and tap <strong>Delete Account</strong></li>
    <li>Confirm the deletion</li>
  </ol>
  <p>This immediately and permanently removes your email, display name, group memberships, order history, and device tokens from our servers. This action cannot be undone.</p>

  <h2>Access is invite-only</h2>
  <p>RunCart is a closed, invite-only application. You can only create an account if you have received a personal invite code from a group administrator. We do not accept public signups.</p>

  <h2>Contact</h2>
  <p>For any privacy-related questions, contact us at <a href="mailto:wygnesh@gmail.com">wygnesh@gmail.com</a>.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
