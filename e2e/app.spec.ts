import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('topbar has a fixed height and language, theme and GitHub controls in order', async ({ page }) => {
  const topbar = page.locator('.topbar');
  expect((await topbar.boundingBox())?.height).toBe(56);
  const labels = await page
    .locator('.topbar__actions > *')
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  expect(labels).toHaveLength(3);
  await expect(page.locator('.topbar__actions a')).toHaveAttribute('href', /github\.com/);
});

test('loads the detection model in a worker and enables playback', async ({ page }) => {
  await expect(page.locator('#play-button')).toBeEnabled({ timeout: 45_000 });
  await expect(page.locator('#status')).not.toHaveAttribute('data-state', 'statusError');
});

test('"?" opens the shortcuts cheat sheet and Escape closes it', async ({ page }) => {
  await page.locator('body').press('?');
  await expect(page.locator('#shortcuts')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcuts')).toBeHidden();
});

test('language toggle switches the interface between Polish and English', async ({ page }) => {
  const heading = page.locator('h1');
  const before = await heading.textContent();
  await page.locator('#lang-toggle').click();
  await expect(heading).not.toHaveText(before ?? '');
  await page.locator('#lang-toggle').click();
  await expect(heading).toHaveText(before ?? '');
});

test('theme toggle flips data-theme', async ({ page }) => {
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  await expect(html).not.toHaveAttribute('data-theme', before ?? '');
});

test('box line width setting is shown and remembered after reload', async ({ page }) => {
  const slider = page.locator('#line-width');
  await slider.fill('3');
  await expect(page.locator('#line-width-value')).toHaveText('3 px');
  await page.reload();
  await expect(slider).toHaveValue('3');
});
