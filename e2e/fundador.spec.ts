import { test, expect } from '@playwright/test'

const metaContent = (html: string, property: string) =>
  html.match(new RegExp(`<meta property="${property}" content="([^"]+)"`))?.[1]

test.describe('Campanha de fundadores', () => {
  test('entrega o card a scraper sem login, com imagem acessível', async ({ request }) => {
    const headers = { 'user-agent': 'WhatsApp/2.24.1.0 A' }

    const page = await request.get('/fundador', { headers, maxRedirects: 0 })
    expect(page.status()).toBe(200)

    const html = await page.text()
    expect(metaContent(html, 'og:title')).toContain('fundadores')

    const imageUrl = metaContent(html, 'og:image')
    expect(imageUrl).toBeTruthy()
    expect(metaContent(html, 'og:image:width')).toBe('1200')
    expect(metaContent(html, 'og:image:height')).toBe('630')

    const { pathname, search } = new URL(imageUrl!.replaceAll('&amp;', '&'))
    const image = await request.get(pathname + search, { headers, maxRedirects: 0 })
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/jpeg')
  })

  test('leva quem abre no navegador para o cadastro', async ({ page }) => {
    await page.goto('/fundador')
    await expect(page).toHaveURL(/\/register$/)
  })

  test('voltar a partir do cadastro não prende a pessoa na campanha', async ({ page }) => {
    await page.goto('/login')
    await page.goto('/fundador')
    await expect(page).toHaveURL(/\/register$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
  })

  test.describe('sem JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('oferece o botão para o cadastro', async ({ page }) => {
      await page.goto('/fundador')
      await expect(page).toHaveURL(/\/fundador$/)
      await expect(page.getByRole('link', { name: 'Garantir minha vaga' })).toHaveAttribute('href', '/register')
    })
  })
})
