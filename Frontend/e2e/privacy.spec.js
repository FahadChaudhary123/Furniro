import { test, expect } from '@playwright/test';

/**
 * Data collection, and specifically the absence of it — `PRIV-06`.
 *
 * Two forms used to solicit a name, an email address and a message, and discard all three.
 * The contact form had no submit handler, so pressing Submit triggered a native GET, reloaded
 * the page and lost the message; a customer had every reason to believe it had been sent.
 *
 * These assert the honest state: the controls are disabled, the reason is visible, and no
 * personal data leaves the page. The most important test here is the last one — re-enabling a
 * field without wiring it up is the regression, and it is invisible in a code review that
 * only looks at the diff's own file.
 *
 * See docs/PROCESSING_REGISTER.md for what the system does still process.
 */

test.describe('the contact form does not collect what it cannot deliver', () => {
  test('says plainly that it is unavailable', async ({ page }) => {
    await page.goto('/contact');

    const notice = page.locator('#contact-form-unavailable');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/not available/i);
    // A dead form with no explanation is the same failure wearing a different hat.
    await expect(notice).toContainText(/phone|address/i);
  });

  test('every field and the submit button are disabled', async ({ page }) => {
    await page.goto('/contact');

    for (const name of ['name', 'email', 'subject', 'message']) {
      await expect(page.locator(`[name="${name}"]`), `${name} must be disabled`).toBeDisabled();
    }
    await expect(page.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  test('the page cannot be made to submit anything', async ({ page }) => {
    await page.goto('/contact');
    const before = page.url();

    // Submit the form programmatically, bypassing the disabled button entirely — the check
    // that matters is whether a submission can happen at all, not whether a click is blocked.
    await page.evaluate(() => document.querySelector('form')?.requestSubmit?.());
    await page.waitForTimeout(500);

    // A native GET would append "?" and reload. Disabled fields submit nothing, but a
    // reload alone is what silently discarded the customer's message.
    expect(page.url()).toBe(before);
  });
});

test.describe('the newsletter does not collect email addresses', () => {
  test('the input and button are disabled, with a reason', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('footer input[type="email"]')).toBeDisabled();
    await expect(page.locator('#newsletter-unavailable')).toContainText(/not available/i);
  });

  test('the disabled field is still described to a screen reader', async ({ page }) => {
    // Disabling a control without labelling it leaves a screen-reader user with an
    // unexplained dead input rather than an explained one.
    await page.goto('/');
    const input = page.locator('footer input[type="email"]');
    await expect(input).toHaveAttribute('aria-label', /email/i);
    await expect(input).toHaveAttribute('aria-describedby', 'newsletter-unavailable');
  });
});

test.describe('nothing personal leaves the page', () => {
  test('no request carries an email address or a message body', async ({ page }) => {
    const suspicious = [];
    page.on('request', (request) => {
      const url = request.url();
      let body = '';
      try {
        body = request.postDataBuffer()?.toString('utf8') ?? '';
      } catch {
        body = '';
      }
      if (/@example\.com|SECRET-MESSAGE/i.test(url + body)) {
        suspicious.push(`${request.method()} ${url}`);
      }
    });

    await page.goto('/contact');
    // Wait for React to mount the form before reaching into it. `goto` resolves on `load`,
    // which is before the first render, so an immediate `evaluate` finds no fieldset and
    // silently enables nothing.
    await page.waitForSelector('form fieldset');

    // Force values in past the disabled attribute — this is what a regression would look
    // like, and it proves the assertion is about behaviour rather than about the attribute.
    await page.evaluate(() => {
      // The fieldset has to be re-enabled too: a disabled <fieldset> disables every
      // descendant regardless of their own `disabled` property, which is precisely why the
      // markup uses one. Clearing the inputs alone leaves them still disabled.
      for (const el of document.querySelectorAll('fieldset, input, textarea')) {
        el.disabled = false;
      }
    });
    await page.fill('[name="email"]', 'visitor@example.com');
    await page.fill('[name="message"]', 'SECRET-MESSAGE');
    await page.evaluate(() => document.querySelector('form')?.requestSubmit?.());
    await page.waitForTimeout(800);

    expect(suspicious, `personal data left the page:\n  ${suspicious.join('\n  ')}`).toEqual([]);
  });

  test('the cart in browser storage holds only slugs and quantities', async ({ page }) => {
    // docs/PROCESSING_REGISTER.md activity 4 claims this. A register that is wrong once is
    // never trusted again, so the claim is asserted rather than described.
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: /add to cart/i }).first().click();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() => window.localStorage.getItem('furniro.cart.v1'));
    expect(stored, 'the cart should be stored under the documented key').toBeTruthy();

    const lines = JSON.parse(stored);
    expect(Array.isArray(lines)).toBe(true);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(['quantity', 'slug']);
    }
  });

  test('browser storage holds nothing beyond the cart', async ({ page }) => {
    // Catches a future feature quietly persisting something the register does not mention.
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.filter((k) => k !== 'furniro.cart.v1')).toEqual([]);

    const sessionKeys = await page.evaluate(() => Object.keys(window.sessionStorage));
    expect(sessionKeys).toEqual([]);

    const cookies = await page.context().cookies();
    expect(cookies.map((c) => c.name)).toEqual([]);
  });
});

test.describe('no control promises something it cannot do', () => {
  /**
   * The same defect class as the two forms: an element that signals interactivity and does
   * nothing. Four shipped at once — a `BUY NOW` button that went nowhere, an `Explore More`
   * button that went nowhere, navbar account and wishlist icons styled `cursor-pointer` for
   * features that do not exist, and `Share`/`Compare`/`Like` as bare `<span>`s.
   *
   * A visitor cannot tell the difference between a control that is broken and one that was
   * never wired up. Both read as "this site is broken".
   */
  const PAGES = ['/', '/shop', '/shop/syltherine', '/cart', '/contact', '/about'];

  for (const path of PAGES) {
    test(`${path} has no button without a handler`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });

      const dead = await page.$$eval('button, [role="button"]', (els) =>
        els
          .filter((el) => !el.disabled && el.getAttribute('type') !== 'submit')
          .filter((el) => {
            // React attaches handlers as props on the fiber, not as an inline onclick.
            const entry = Object.entries(el).find(([k]) => k.startsWith('__reactProps'));
            return !(entry?.[1] && typeof entry[1].onClick === 'function');
          })
          .map((el) => (el.textContent || '').trim() || el.getAttribute('aria-label') || '(unnamed)'),
      );

      expect(dead, `buttons that do nothing on ${path}:\n  ${dead.join('\n  ')}`).toEqual([]);
    });
  }

  test('no action label exists without a control behind it', async ({ page }) => {
    // Share, Compare and Like were <span>s inside a hover overlay — verbs promising three
    // features that do not exist, unreachable by keyboard, announced as loose words.
    await page.goto('/shop', { waitUntil: 'networkidle' });
    const phantom = await page
      .locator('span:text-is("Share"), span:text-is("Compare"), span:text-is("Like")')
      .count();
    expect(phantom).toBe(0);
  });

  test('decorative icons are hidden from assistive technology', async ({ page }) => {
    // The account and wishlist icons stay for visual balance but do nothing, so they must
    // not be announced — an unlabelled graphic is noise in a screen reader's output.
    await page.goto('/');
    const header = page.locator('header');
    for (const cls of ['lucide-user', 'lucide-heart']) {
      const icon = header.locator(`svg.${cls}`).first();
      if ((await icon.count()) === 0) continue;
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
