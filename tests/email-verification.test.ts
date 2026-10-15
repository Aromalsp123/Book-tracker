import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RESEND_COOLDOWN_MS,
  canResend,
  verificationEmailSettings,
} from '../src/lib/firebase/emailVerification.ts';

test('the verification email only ever carries this app\'s own origin', () => {
  assert.deepEqual(verificationEmailSettings('https://book.ankile.com'), {
    url: 'https://book.ankile.com/',
    handleCodeInApp: false,
  });
  assert.equal(verificationEmailSettings('http://localhost:5173').url, 'http://localhost:5173/');
  assert.equal(verificationEmailSettings('http://127.0.0.1:4173').url, 'http://127.0.0.1:4173/');
  for (const origin of [
    'http://book.ankile.com',
    'https://book.ankile.com/somewhere',
    'https://evil.example?x=book.ankile.com',
    'javascript:alert(1)',
    '',
  ]) {
    assert.throws(() => verificationEmailSettings(origin), /Refusing to put/, origin);
  }
});

test('resend waits out the cooldown after a send', () => {
  assert.equal(canResend(null, 1_000), true);
  assert.equal(canResend(1_000, 1_000 + RESEND_COOLDOWN_MS - 1), false);
  assert.equal(canResend(1_000, 1_000 + RESEND_COOLDOWN_MS), true);
});

// The Svelte side cannot run under node:test; pin the wiring instead.
const authSource = readFileSync('src/lib/firebase/auth.ts', 'utf8');
const layoutSource = readFileSync('src/routes/+layout.svelte', 'utf8');
const meSource = readFileSync('src/routes/me/+page.svelte', 'utf8');

test('sign-up sends the verification email to the account it just created', () => {
  assert.match(
    authSource,
    /const credential = await createUserWithEmailAndPassword\(auth, email, password\);[\s\S]*?await sendVerificationEmail\(credential\.user, window\.location\.origin\);/,
  );
});

test('every signed-in user has its token claim reconciled with the account record', () => {
  assert.match(
    authSource,
    /onAuthStateChanged\(auth, \(u\) => \{[\s\S]*?if \(u !== null\) void syncVerifiedClaim\(u\)/,
  );
});

test('confirming verification re-emits the user so templates see the new claim', () => {
  assert.match(
    authSource,
    /const verified = await refreshVerification\(signedInUser\(\)\);\s*if \(verified\) user\.reemit\(\);\s*return verified;/,
  );
});

test('signed-out visitors see a public landing page with working auth actions', () => {
  assert.doesNotMatch(layoutSource, /import Login from/);
  assert.match(layoutSource, /<PublicLanding \/>/);
  const landingSource = readFileSync('src/lib/components/PublicLanding.svelte', 'utf8');
  assert.match(landingSource, /Get Started/);
  assert.match(landingSource, /Create your account/);
  assert.match(landingSource, /Log in/);
  assert.match(landingSource, /signUp\(email, password\)/);
  assert.match(landingSource, /signIn\(email, password\)/);
  assert.doesNotMatch(landingSource, /10K\+|100K\+|4\.8/);
  assert.match(landingSource, /src="\/icons\/book-tracker-512\.png"/);
});

test('the profile page no longer tells an unverified user the app cannot verify them', () => {
  assert.doesNotMatch(meSource, /cannot verify it yet/);
  assert.match(meSource, /verification email/);
});

// The shared author catalog is readable by verified accounts only
// (firestore.rules), so an unverified account's author listener never
// delivers. Without these two pieces of copy that looks like a bug: rows
// without author names and an "Authors loading." submit that never ends.
test('unverified accounts are told what verification unlocks', () => {
  const modal = readFileSync('src/lib/components/NewBookModal.svelte', 'utf8');
  const guard = modal.indexOf('if ($user && !$user.emailVerified) {');
  const loading = modal.indexOf("lookupError = 'Authors loading.'");
  assert.ok(guard !== -1, 'the modal checks the verification state before submitting');
  assert.ok(guard < loading, 'the verification message comes before the loading fallback');
  assert.match(modal, /lookupError = 'Verify your email address to add or edit books\.'/);
});
