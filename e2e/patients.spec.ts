import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_USER_EMAIL    ?? ''
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? ''

test.describe('Carteira de Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', E2E_EMAIL)
    await page.fill('[name="password"]', E2E_PASSWORD)
    await page.click('[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('fluxo completo: criar paciente e visualizar na listagem', async ({ page }) => {
    await page.click('text=Novo paciente')
    await page.waitForURL('**/patients/new')

    await page.selectOption('#specialty', 'Cardiologia')
    await page.click('text=Fácil')

    // OpenAI pode demorar até 25s
    await page.click('[type="submit"]')
    await page.waitForURL('**/patients/**', { timeout: 30_000 })

    expect(page.url()).toMatch(/\/patients\/[0-9a-f-]+$/)
    await expect(page.locator('text=Iniciar atendimento')).toBeVisible()
    await expect(page.locator('text=Estado clínico')).toBeVisible()
    await expect(page.locator('text=Nenhuma consulta realizada ainda')).toBeVisible()

    await page.goto('/dashboard')
    await expect(page.locator('text=Cardiologia')).toBeVisible()
  })

  test('botão Iniciar atendimento leva ao stub de consulta', async ({ page }) => {
    await page.goto('/dashboard')
    const firstPatient = page.locator('ul li a').first()

    if (await firstPatient.count() === 0) {
      test.skip()
      return
    }

    await firstPatient.click()
    await page.waitForURL('**/patients/**')
    await page.click('text=Iniciar atendimento')
    await page.waitForURL('**/consultations/stub')
    await expect(page.locator('text=Consulta em breve')).toBeVisible()
  })
})
