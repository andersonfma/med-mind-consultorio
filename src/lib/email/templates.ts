import 'server-only'

export const APP_URL = 'https://app.medmindedu.com.br'

const CYAN = '#0E7C86'   // ciano legível sobre fundo claro (acessível em email)
const INK = '#0A0F14'
const MUTED = '#5B6B78'

function layout(bodyInner: string, unsubUrl: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#EEF2F4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:16px;">Med<span style="color:${CYAN}">Mind</span></div>
    <div style="background:#ffffff;border:1px solid #E1E8EC;border-radius:14px;padding:24px;">
      ${bodyInner}
    </div>
    <p style="font-size:11px;color:${MUTED};text-align:center;margin:18px 8px 0;line-height:1.6;">
      Você recebe este email porque tem conta no Med Mind.<br>
      <a href="${unsubUrl}" style="color:${MUTED};text-decoration:underline;">Descadastrar destes emails</a>
    </p>
  </div>
</body></html>`
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${CYAN};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${label}</a>`
}

/** Email de onboarding: o que é, como funciona, e a aposta do desafio. */
export function explainerEmail(params: { name: string; unsubUrl: string }): { subject: string; html: string; text: string } {
  const name = params.name?.trim() || 'futuro doutor(a)'
  const inner = `
    <h1 style="font-size:20px;margin:0 0 10px;">Oi, ${name}! Bem-vindo(a) ao Med Mind 🩺</h1>
    <p style="font-size:14px;color:${MUTED};line-height:1.6;margin:0 0 16px;">
      O Med Mind é onde você <b style="color:${INK}">treina a consulta clínica</b> com pacientes virtuais e recebe uma
      <b style="color:${INK}">avaliação do seu raciocínio por IA</b> — e ainda compete com colegas. Em 2 minutos você entende tudo:
    </p>

    <div style="font-size:14px;line-height:1.6;margin:0 0 18px;">
      <p style="margin:0 0 8px;"><b style="color:${CYAN}">1. Atenda um paciente</b><br>
        <span style="color:${MUTED}">Converse, peça exames, defina a conduta e feche o diagnóstico. Ao <b style="color:${INK}">Finalizar</b>, você recebe sua nota de raciocínio, um radar de desempenho e um card pra compartilhar.</span></p>
      <p style="margin:0 0 8px;"><b style="color:${CYAN}">2. Desafio da semana</b><br>
        <span style="color:${MUTED}">Um caso clínico por semana, <b style="color:${INK}">um quiz por dia</b> (seg→sex), da anamnese à conduta. É rápido e vira hábito.</span></p>
      <p style="margin:0;"><b style="color:${CYAN}">3. Aposte seus MedCoins 💰</b><br>
        <span style="color:${MUTED}">No quiz do dia você pode <b style="color:${INK}">apostar MedCoins</b> no seu palpite: <b style="color:${INK}">acertou, ganha; errou, perde</b>. Na sexta (conclusão) o acerto <b style="color:${INK}">paga em dobro</b>. Quanto mais confiante, mais aposta — e sobe no ranking.</span></p>
    </div>

    <div style="text-align:center;margin:22px 0 6px;">${btn('Treinar agora →', APP_URL)}</div>
    <p style="font-size:12px;color:${MUTED};text-align:center;margin:8px 0 0;">Seu primeiro paciente leva menos de um minuto pra começar.</p>
  `
  const text = `Oi, ${name}! Bem-vindo(a) ao Med Mind.

O Med Mind é onde você treina a consulta clínica com pacientes virtuais e recebe uma avaliação do seu raciocínio por IA — e ainda compete com colegas. Em 2 minutos você entende tudo:

1. Atenda um paciente: converse, peça exames, defina a conduta e feche o diagnóstico. Ao Finalizar, você recebe sua nota de raciocínio, um radar de desempenho e um card pra compartilhar.

2. Desafio da semana: um caso clínico por semana, um quiz por dia (seg a sex), da anamnese à conduta.

3. Aposte seus MedCoins: no quiz do dia você pode apostar MedCoins no seu palpite — acertou, ganha; errou, perde. Na sexta (conclusão) o acerto paga em dobro.

Treinar agora: ${APP_URL}

Para não receber mais estes emails: ${params.unsubUrl}`

  return { subject: 'Como o Med Mind funciona — e a aposta do desafio da semana', html: layout(inner, params.unsubUrl), text }
}

/** Email semanal (segunda): anuncia o novo Caso da Semana + chama pro quiz. */
export function weeklyChallengeEmail(params: { name: string; caseTitle: string; unsubUrl: string }): { subject: string; html: string; text: string } {
  const name = params.name?.trim() || 'futuro doutor(a)'
  const caseTitle = (params.caseTitle || 'Caso da Semana').replace(/^Caso da Semana:\s*/i, '')
  const url = `${APP_URL}/desafio`
  const inner = `
    <p style="font-size:13px;color:${MUTED};margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em;">Novo caso da semana</p>
    <h1 style="font-size:20px;margin:0 0 10px;">${caseTitle}</h1>
    <p style="font-size:14px;color:${MUTED};line-height:1.6;margin:0 0 16px;">
      Oi, ${name}! Começou um novo <b style="color:${INK}">Caso da Semana</b>. São <b style="color:${INK}">5 dias</b> (seg a sex),
      <b style="color:${INK}">um quiz por dia</b> — da anamnese à conduta. E você pode <b style="color:${INK}">apostar seus MedCoins</b> no palpite:
      acertou, ganha; errou, perde; na sexta o acerto paga em dobro. Resolva o de hoje em 1 minuto:
    </p>
    <div style="text-align:center;margin:20px 0 6px;">${btn('Resolver o desafio de hoje →', url)}</div>
    <p style="font-size:12px;color:${MUTED};text-align:center;margin:8px 0 0;">Resolvendo todo dia você mantém o streak 🔥 e sobe no ranking.</p>
  `
  const text = `Novo Caso da Semana: ${caseTitle}

Oi, ${name}! Começou um novo Caso da Semana — 5 dias (seg a sex), um quiz por dia, da anamnese à conduta. Você pode apostar seus MedCoins no palpite: acertou, ganha; errou, perde; na sexta o acerto paga em dobro.

Resolver o desafio de hoje: ${url}

Para não receber mais estes emails: ${params.unsubUrl}`
  return { subject: `Novo caso da semana: ${caseTitle}`, html: layout(inner, params.unsubUrl), text }
}
