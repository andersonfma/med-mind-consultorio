import { test, expect } from '@playwright/test'

const timestamp = Date.now()
const testUser = {
  fullName: 'Test User Foundation',
  email: `test-${timestamp}@medmind-test.dev`,
  password: 'TestPass123!',
}

test.describe('Autenticação', () => {
  test('redireciona usuário não autenticado para login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })

  test('cadastro de novo usuário redireciona para dashboard', async ({
    page,
  }) => {
    await page.goto('/register')
    await page.fill('#fullName', testUser.fullName)
    await page.fill('#email', testUser.email)
    await page.fill('#password', testUser.password)
    await page.selectOption('#role', 'student')
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/)
  })

  test('login após cadastro redireciona para dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', testUser.email)
    await page.fill('#password', testUser.password)
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/)
  })

  test('usuário autenticado é redirecionado do login para dashboard', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.fill('#email', testUser.email)
    await page.fill('#password', testUser.password)
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/.*dashboard/)
    await page.goto('/login')
    await expect(page).toHaveURL(/.*dashboard/)
  })
})
