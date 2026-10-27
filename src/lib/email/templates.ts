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
export function explainerEmail(params: { name: string; unsubUrl: string }): { subject: string; html: string } {
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
  return { subject: 'Como o Med Mind funciona (e a aposta do desafio) 🩺', html: layout(inner, params.unsubUrl) }
}
