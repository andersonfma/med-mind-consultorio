import { test, expect } from '@playwright/test'

test('redireciona usuário não autenticado para login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/.*login/)
})
