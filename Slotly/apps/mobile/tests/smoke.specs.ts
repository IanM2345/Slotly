import { test, expect } from '@playwright/test';

test('home shows 4 bottom tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^Home$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Explore$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Appointments?/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Profile$/ })).toBeVisible();
});

test('top-right sign in button routes to /auth/login', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-signin-btn').click();
  await expect(page).toHaveURL(/\/auth\/login/i);
});

test('Home → See all goes to Explore', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /see all/i }).click();
  await expect(page).toHaveURL(/\/explore/i);
});

test('Booking flow: service → date picker → confirm screen shell', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('service-card-haircut').click();           // your stable id
  await expect(page).toHaveURL(/\/booking\/service/);

  // date & time step (calendar view)
  await expect(page.getByRole('heading', { name: /select date/i })).toBeVisible();
  await page.getByRole('button', { name: /^25$/ }).click();          // pick a date
  await page.getByRole('button', { name: /12:00|12:15|12:30/ }).click();

  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/booking\/payment/i);
});