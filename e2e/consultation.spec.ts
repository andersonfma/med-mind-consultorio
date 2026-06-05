import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

test.describe('Fluxo de Consulta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', E2E_EMAIL)
    await page.fill('[name="password"]', E2E_PASSWORD)
    await page.click('[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('iniciar consulta, enviar mensagem, atualizar anamnese e finalizar', async ({ page }) => {
    // Navigate to first patient
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()
    if (await firstPatient.count() === 0) { test.skip(); return }
    await firstPatient.click()
    await page.waitForURL('**/patients/**')

    // Start consultation
    await page.click('text=Iniciar atendimento')
    await page.waitForURL('**/consultations/**', { timeout: 10_000 })

    // Send message
    await page.fill('input[placeholder*="mensagem"]', 'Olá, como o senhor está se sentindo?')
    await page.click('text=Enviar')
    await expect(page.locator('text=Paciente').first()).toBeVisible({ timeout: 30_000 })

    // Update anamnesis
    await page.click('text=Atualizar anamnese')
    await page.waitForTimeout(5_000)

    // Finish consultation
    await page.click('text=Finalizar consulta')
    await expect(page.getByRole('heading', { name: 'Finalizar consulta' })).toBeVisible()
    await page.fill('textarea', 'Hipertensão arterial sistêmica')
    await page.click('text=Confirmar')
    await page.waitForURL('**/patients/**', { timeout: 30_000 })

    // Verify history
    await expect(page.locator('text=Consultas anteriores')).toBeVisible()
    await expect(page.locator('text=Hipertensão arterial sistêmica')).toBeVisible()
  })

  test('consulta ongoing exibe banner Continuar', async ({ page }) => {
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()
    if (await firstPatient.count() === 0) { test.skip(); return }
    await firstPatient.click()
    await page.waitForURL('**/patients/**')

    const continuar = page.locator('text=Continuar consulta')
    const iniciar   = page.locator('text=Iniciar atendimento')
    await expect(continuar.or(iniciar)).toBeVisible()
  })
})
