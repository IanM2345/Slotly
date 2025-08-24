import { test, expect } from '@playwright/test';

test('Settings: all subpages are reachable', async ({ page }) => {
  await page.goto('/settings');
  const items = [
    'Account Details',
    'Payment Details',
    'Family & Friends',
    'Address',
    'Language',
    'Country',
    'Change Password',
    'Support',
    'Feedback',
    'About'
  ];
  for (const label of items) {
    await page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).click();
    await expect(page.getByRole('heading', { name: new RegExp(label, 'i') })).toBeVisible();
    await page.goBack();
  }
});

test('Settings: has Switch to Business Account entry', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /switch to business account/i })).toBeVisible();
});
