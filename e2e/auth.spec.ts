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

  test('cadastro exibe tela de confirmação de e-mail', async ({ page }) => {
    await page.goto('/register')
    await page.fill('#fullName', testUser.fullName)
    await page.fill('#email', testUser.email)
    await page.fill('#password', testUser.password)
    await page.selectOption('#role', 'student')
    await page.click('[type="submit"]')
    await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible()
    await expect(page.getByText(testUser.email)).toBeVisible()
  })

  test('callback com código inválido redireciona para login com erro', async ({ page }) => {
    await page.goto('/auth/callback?code=invalid_code')
    await expect(page).toHaveURL(/.*login\?error=confirmation_failed/)
  })

  test('callback sem código redireciona para login com erro', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL(/.*login\?error=confirmation_failed/)
  })
})
