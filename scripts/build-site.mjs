// Gerador do site de marketing multipágina (medmindedu.com.br).
// Header/rodapé compartilhados; cada página tem conteúdo focado. CSS em /site.css.
// Rodar: node scripts/build-site.mjs  → escreve public/landing.html + public/site/*.html
import { writeFileSync, mkdirSync } from 'node:fs'

const APP = 'https://app.medmindedu.com.br'
const REGISTER = `${APP}/register`
const LOGIN = `${APP}/login`

const SYMBOL = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="mm" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#22E0E6"/>
    <g stroke="#04191A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <line x1="7.5" y1="8.5" x2="24.5" y2="8.5"/><line x1="9.3" y1="11.2" x2="22.7" y2="11.2"/>
      <line x1="10.8" y1="11.2" x2="10.8" y2="22.6"/><line x1="21.2" y1="11.2" x2="21.2" y2="22.6"/>
      <path d="M12.2 11.2 L16 18.8 L19.8 11.2"/>
    </g>
    <rect x="9.6" y="22.6" width="2.4" height="2.4" rx="0.4" fill="#04191A"/>
    <rect x="20" y="22.6" width="2.4" height="2.4" rx="0.4" fill="#04191A"/>
  </symbol>
</svg>`

const NAV = [
  { href: '/simulador', label: 'Simulador' },
  { href: '/comunidade', label: 'Comunidade' },
  { href: '/simulados', label: 'Simulados' },
  { href: '/faculdades', label: 'Para faculdades' },
]

function head(title, desc) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${APP}/opengraph-image">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${APP}/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">`
}

function header(active) {
  const links = NAV.map(n =>
    `<a class="link" href="${n.href}"${n.href === active ? ' style="color:var(--cyan)"' : ''}>${n.label}</a>`
  ).join('\n      ')
  return `<header class="nav">
  <div class="wrap">
    <a class="brand" href="/">
      <svg class="mark"><use href="#mm"/></svg>
      <span class="wordmark">Med<b>Mind</b></span>
    </a>
    <nav class="nav-links">
      ${links}
    </nav>
    <div class="nav-cta">
      <a class="link" href="${LOGIN}" style="font-size:14px;color:var(--muted)">Entrar</a>
      <a class="btn btn-primary" href="${REGISTER}">Criar conta</a>
    </div>
  </div>
</header>`
}

const FOOTER = `<footer>
  <div class="wrap">
    <div class="brand">
      <span class="wordmark" style="font-size:18px">Med<b>Mind</b></span>
    </div>
    <p class="disc">Med Mind é uma ferramenta de treino e estudo com casos simulados. Não substitui a formação médica, a avaliação institucional nem a conduta clínica real. Simulados “nos moldes” do ENARE/ENAMED são questões originais geradas por IA, não provas oficiais.</p>
    <nav style="display:flex;gap:18px;flex-wrap:wrap">
      <a class="link" href="/simulador" style="font-size:13px">Simulador</a>
      <a class="link" href="/comunidade" style="font-size:13px">Comunidade</a>
      <a class="link" href="/simulados" style="font-size:13px">Simulados</a>
      <a class="link" href="/faculdades" style="font-size:13px">Para faculdades</a>
    </nav>
  </div>
</footer>`

// bloco de oferta "Membros Fundadores" (reutilizado na home)
const FOUNDERS = `<section class="band">
  <div class="wrap">
    <div style="border:1px solid rgba(231,178,58,.34);background:linear-gradient(135deg,rgba(231,178,58,.12),rgba(231,178,58,.03));border-radius:20px;padding:30px 28px;text-align:center">
      <p class="kicker" style="color:#E7B23A">✦ Oferta de lançamento</p>
      <h2 style="font-size:clamp(26px,4vw,38px);margin-top:10px">Seja um dos <span style="color:#E7B23A">Membros Fundadores</span>.</h2>
      <p style="color:var(--muted);font-size:17px;max-width:48ch;margin:14px auto 0">Os <b style="color:var(--fog)">50 primeiros usuários ativos</b> ganham <b style="color:var(--fog)">1 ano de Premium grátis</b> — consultas e especialidades ilimitadas e os simulados de ENARE/ENAMED. Ativo = complete 5 consultas e participe do desafio da semana em 5 dias.</p>
      <div class="hero-cta" style="justify-content:center;margin-top:26px"><a class="btn btn-primary" href="${REGISTER}">Garantir minha vaga →</a></div>
    </div>
  </div>
</section>`

function finalCta(title, text, cta = 'Criar conta grátis →', href = REGISTER) {
  return `<section class="final">
  <div class="stripes"></div>
  <div class="wrap">
    <h2>${title}</h2>
    <p>${text}</p>
    <a class="btn btn-primary" href="${href}">${cta}</a>
  </div>
</section>`
}

function page({ title, desc, active, body }) {
  return `${head(title, desc)}
${SYMBOL}
${header(active)}
<main id="top">
${body}
</main>
${FOOTER}`
}

// ─────────────────────────── HOME ───────────────────────────
const CHATMOCK = `<div class="hero-visual reveal d3">
  <div class="chatmock">
    <div class="cm-head">
      <div><div class="sc-name">Marília, 54</div><div class="sc-sub">Hepatologia · consulta em andamento</div></div>
      <span class="pill">ao vivo</span>
    </div>
    <div class="cm-body">
      <div class="bub bot">Doutor, ando muito cansada e minha barriga inchou nas últimas semanas…</div>
      <div class="bub me">Percebeu mudança na cor da urina ou nos olhos?</div>
      <div class="bub audio">
        <button class="play" aria-hidden="true">▶</button>
        <span class="wave"><i style="height:8px;animation-delay:0s"></i><i style="height:16px;animation-delay:.10s"></i><i style="height:22px;animation-delay:.20s"></i><i style="height:12px;animation-delay:.30s"></i><i style="height:20px;animation-delay:.15s"></i><i style="height:9px;animation-delay:.25s"></i><i style="height:18px;animation-delay:.05s"></i><i style="height:22px;animation-delay:.35s"></i><i style="height:11px;animation-delay:.20s"></i><i style="height:16px;animation-delay:.10s"></i></span>
        <span class="dur">0:14</span>
      </div>
    </div>
    <div class="cm-input">
      <span class="cm-field">Escreva sua pergunta…</span>
      <button class="cm-mic" aria-label="Falar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/></svg></button>
    </div>
    <p class="cm-cap">Converse por texto ou por voz — como numa consulta real.</p>
  </div>
</div>`

const ECO = [
  { href: '/simulador', k: 'Treino', h: 'Simulador clínico', p: 'Atenda pacientes virtuais com IA e receba a avaliação do seu raciocínio e da sua comunicação.' },
  { href: '/comunidade', k: 'Comunidade', h: 'Feed, desafio e ranking', p: 'Troque casos e dúvidas, encare o desafio diário com aposta de MedCoins e dispute o ranking.' },
  { href: '/simulados', k: 'Estudo', h: 'Simulados ENARE/ENAMED', p: 'Questões por IA nos moldes das provas, por área, com gabarito comentado.' },
  { href: '/faculdades', k: 'Instituições', h: 'Para faculdades e ligas', p: 'Um painel para o coordenador acompanhar o desempenho pedagógico da turma.' },
]

const home = page({
  title: 'Med Mind — o ecossistema de quem estuda medicina',
  desc: 'Simulador clínico com IA, comunidade, desafio diário e simulados ENARE/ENAMED. Treine o raciocínio clínico e faça parte da comunidade dos estudantes de medicina do Brasil.',
  active: '/',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap">
      <div class="hero-copy">
        <p class="eyebrow reveal d1">O ecossistema de quem estuda medicina</p>
        <h1 class="reveal d2">Treine o <span class="hl">raciocínio clínico</span> — e faça parte da comunidade.</h1>
        <p class="lead reveal d3">Simulador com IA, comunidade, desafio diário e simulados de ENARE/ENAMED. Tudo num app só, feito para estudantes de medicina do Brasil.</p>
        <div class="hero-cta reveal d4">
          <a class="btn btn-primary" href="${REGISTER}">Criar conta grátis →</a>
          <a class="btn btn-ghost" href="#eco">Ver o ecossistema</a>
        </div>
        <div class="facts reveal d4">
          <div class="fact"><b>9</b><span>especialidades clínicas</span></div>
          <div class="fact"><b>7</b><span>dias de desafio por semana</span></div>
          <div class="fact"><b>∞</b><span>casos gerados por IA</span></div>
        </div>
      </div>
      ${CHATMOCK}
    </div>
  </section>

  ${FOUNDERS}

  <section class="band" id="eco">
    <div class="wrap">
      <div class="sec-head">
        <span class="kicker">Um app, quatro pilares</span>
        <h2>O ecossistema Med Mind.</h2>
        <p>Cada parte reforça a outra: você treina, estuda, compete e evolui — junto com a sua turma.</p>
      </div>
      <div class="aud">
        ${ECO.map(c => `<a class="card" href="${c.href}" style="text-decoration:none;color:inherit;display:block;transition:transform .2s,border-color .2s" onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='var(--cyan)'" onmouseout="this.style.transform='';this.style.borderColor=''">
          <div class="k">${c.k}</div><h3>${c.h}</h3><p>${c.p}</p>
          <span style="display:inline-block;margin-top:12px;font-size:13px;font-weight:600;color:var(--cyan)">Conhecer →</span>
        </a>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="band" id="faculdades-teaser">
    <div class="wrap">
      <div class="feat">
        <div>
          <span class="kicker">Para quem ensina</span>
          <h2 style="font-size:clamp(26px,3.6vw,36px);margin-top:12px">Faculdades e ligas acompanham a turma de perto.</h2>
          <p style="color:var(--muted);font-size:16px;margin-top:14px;max-width:46ch">Um painel do coordenador com o diagnóstico pedagógico da turma — raciocínio, condutas, coerência de exames e engajamento. Traga sua turma para onde os alunos já treinam.</p>
          <div class="hero-cta" style="margin-top:22px"><a class="btn btn-ghost" href="/faculdades">Ver para faculdades →</a></div>
        </div>
        <div class="aud" style="grid-template-columns:1fr 1fr">
          <div class="card"><div class="k">Turma</div><h3>Diagnóstico pedagógico</h3><p>Médias de raciocínio e comunicação, pontos a fortalecer.</p></div>
          <div class="card"><div class="k">Aluno</div><h3>Ficha individual</h3><p>Evolução de cada estudante, do básico à residência.</p></div>
        </div>
      </div>
    </div>
  </section>

  ${finalCta('Comece agora — é grátis.', 'Crie sua conta em um minuto e atenda seu primeiro paciente ainda hoje.')}`
})

// ─────────────────────────── SIMULADOR ───────────────────────────
const STEPS = [
  ['01', 'Receba o paciente', 'Um caso realista gerado por IA, com queixa, história e contexto — em nove especialidades.'],
  ['02', 'Conduza a consulta', 'Converse por texto ou voz, faça o exame físico e peça exames. A IA só aprova pedidos com nexo clínico.'],
  ['03', 'Defina a conduta', 'Prescreva e feche o diagnóstico. Cada decisão é sua, como no consultório.'],
  ['04', 'Receba a avaliação', 'Uma nota do seu raciocínio (AB4) e da sua comunicação, com um radar de desempenho e um card para compartilhar.'],
]
const AB4 = [
  ['A', 'Anamnese', 'A coleta da história — o quanto você investiga e levanta hipóteses.'],
  ['B', 'Exame & evidências', 'Exame físico e exames complementares pedidos com coerência.'],
  ['B', 'Base diagnóstica', 'A síntese: fechar a hipótese certa a partir dos dados.'],
  ['4', 'Boa conduta', 'A decisão terapêutica e o fechamento do caso.'],
]
const simulador = page({
  title: 'Med Mind — Simulador clínico com IA',
  desc: 'Atenda pacientes virtuais com IA, conduza a consulta do início ao fim e receba a avaliação do seu raciocínio (método AB4) e da sua comunicação, em nove especialidades.',
  active: '/simulador',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap">
      <div class="hero-copy">
        <p class="eyebrow reveal d1">O treino</p>
        <h1 class="reveal d2">Uma consulta de <span class="hl">verdade</span>, do início ao diagnóstico.</h1>
        <p class="lead reveal d3">Nada de múltipla escolha. Você conversa, examina, investiga e decide — e recebe uma avaliação objetiva do seu raciocínio e da sua comunicação.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="${REGISTER}">Treinar agora →</a></div>
      </div>
      ${CHATMOCK}
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">O fluxo</span><h2>Como funciona.</h2><p>Quatro passos — como faria no consultório.</p></div>
      <div class="steps">
        ${STEPS.map(([n, h, p]) => `<div class="step"><span class="num">${n}</span><h3>${h}</h3><p>${p}</p></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="band" id="ab4">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">A avaliação</span><h2>Método AB4.</h2><p>Seu raciocínio é avaliado em quatro frentes — não só o diagnóstico final.</p></div>
      <div class="pyr">
        ${AB4.map(([r, w, d]) => `<div class="pyr-tier"><span class="pyr-rn">${r}</span><div class="pyr-main"><div class="pyr-head"><span class="pyr-word">${w}</span></div><p class="pyr-desc">${d}</p></div></div>`).join('\n        ')}
      </div>
      <div class="ab4-closed"><b>Mais comunicação.</b><p>Além do AB4, cada consulta avalia a sua comunicação com o paciente — clareza, empatia e escuta.</p></div>
    </div>
  </section>

  <section class="band" id="especialidades">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">Alcance</span><h2>Nove especialidades clínicas.</h2></div>
      <div class="specs">
        ${['Clínica Médica','Cardiologia','Gastroenterologia','Pneumologia','Endocrinologia','Nefrologia','Neurologia','Infectologia','Hepatologia'].map(s => `<span class="spec">${s}</span>`).join('\n        ')}
      </div>
    </div>
  </section>

  ${finalCta('Atenda seu primeiro paciente hoje.', 'Grátis para começar. Veja sua primeira avaliação em minutos.')}`
})

// ─────────────────────────── COMUNIDADE ───────────────────────────
const comunidade = page({
  title: 'Med Mind — a comunidade dos estudantes de medicina',
  desc: 'Feed com casos e dúvidas, stories, desafio da semana com aposta de MedCoins e ranking. Estude e evolua junto com a sua turma.',
  active: '/comunidade',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap" style="grid-template-columns:1fr">
      <div class="hero-copy" style="max-width:720px">
        <p class="eyebrow reveal d1">A comunidade</p>
        <h1 class="reveal d2">Estudar medicina deixou de ser <span class="hl">solitário</span>.</h1>
        <p class="lead reveal d3" style="max-width:52ch">Um feed para trocar casos e dúvidas, stories, um desafio clínico todo dia e um ranking para disputar com a turma.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="${REGISTER}">Entrar na comunidade →</a></div>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="aud">
        <div class="card"><div class="k">Feed &amp; Stories</div><h3>Casos e dúvidas</h3><p>Poste casos, tire dúvidas, publique stories e siga colegas. Curta e comente — e receba notificações do que acontece com você.</p></div>
        <div class="card"><div class="k">Hábito diário</div><h3>Desafio da semana</h3><p>Um caso clínico por semana, um quiz por dia (7 dias). <b style="color:var(--fog)">Aposte seus MedCoins</b> no palpite: acertou ganha, errou perde; na conclusão paga em dobro.</p></div>
        <div class="card"><div class="k">Disputa</div><h3>Ranking &amp; MedCoin</h3><p>Ganhe MedCoins treinando e acertando o desafio. Suba no ranking semanal e geral entre os estudantes.</p></div>
        <div class="card"><div class="k">Revisão</div><h3>Card de estudo</h3><p>Ao concluir o desafio, você recebe um resumo do caso — diagnóstico, pontos-chave e revisão — para estudar e compartilhar.</p></div>
        <div class="card"><div class="k">Compartilhar</div><h3>Seus resultados viram convite</h3><p>Gere um card do seu desempenho e compartilhe. Quem recebe abre uma página pública e cria a conta em um clique.</p></div>
        <div class="card"><div class="k">Resenhas</div><h3>Artigos e discussões</h3><p>Compartilhe resenhas de artigos e puxe discussões clínicas com a comunidade.</p></div>
      </div>
      <div class="soc-chips">
        <span class="soc-chip"><b>MedCoin</b> — moeda única do ecossistema</span>
        <span class="soc-chip"><b>Notificações</b> no app e no celular</span>
        <span class="soc-chip"><b>Responda dúvidas</b> e ganhe MedCoins</span>
      </div>
    </div>
  </section>

  ${finalCta('Faça parte da comunidade.', 'Grátis para entrar. O desafio de hoje já está esperando.', 'Criar conta grátis →')}`
})

// ─────────────────────────── SIMULADOS ───────────────────────────
const simulados = page({
  title: 'Med Mind — Simulados ENARE / ENAMED por IA',
  desc: 'Simulados nos moldes do ENARE e do ENAMED: questões originais geradas por IA, por área, com dificuldade de prova de residência e gabarito comentado. Recurso Premium.',
  active: '/simulados',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap" style="grid-template-columns:1fr">
      <div class="hero-copy" style="max-width:720px">
        <p class="eyebrow reveal d1" style="color:#E7B23A">Premium · Estudo de prova</p>
        <h1 class="reveal d2">Simulados de <span class="hl">ENARE e ENAMED</span>, por IA.</h1>
        <p class="lead reveal d3" style="max-width:54ch">Questões originais geradas por IA <b style="color:var(--fog)">nos moldes das provas</b> — vinheta clínica, dificuldade de residência e gabarito comentado. Por área, quantas quiser.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="${REGISTER}">Começar a treinar →</a></div>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="aud">
        <div class="card"><div class="k">Fidelidade</div><h3>Nos moldes da prova</h3><p>Analisamos a estrutura, o estilo e a incidência de temas das provas para gerar questões fiéis — ENARE (5 alternativas) e ENAMED (4 alternativas).</p></div>
        <div class="card"><div class="k">Nível</div><h3>Dificuldade de residência</h3><p>Vinhetas clínicas completas com valores de exames e pelo menos dois distratores fortes. Exige raciocínio, não decoreba.</p></div>
        <div class="card"><div class="k">Aprendizado</div><h3>Gabarito comentado</h3><p>Cada questão explica por que a correta é certa e por que os principais distratores enganam.</p></div>
        <div class="card"><div class="k">Cobertura</div><h3>Todas as áreas</h3><p>Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Medicina Preventiva — e Competências Gerais.</p></div>
        <div class="card"><div class="k">Volume</div><h3>Quantos simulados quiser</h3><p>Gere simulados por área sempre que quiser, com questões sempre novas.</p></div>
        <div class="card" style="border-color:rgba(231,178,58,.4);background:rgba(231,178,58,.05)"><div class="k" style="color:#E7B23A">Em breve</div><h3>Relatório de tendências</h3><p>Os temas que mais caem e os seus pontos fracos, para estudar o que importa.</p></div>
      </div>
      <p style="margin-top:22px;font-size:13px;color:var(--muted-2);max-width:70ch">As questões são originais, geradas por IA nos moldes das provas. O Med Mind não reproduz questões reais do ENARE/ENAMED nem é afiliado às bancas.</p>
    </div>
  </section>

  ${finalCta('Estude no nível da prova.', 'Os simulados são um recurso Premium — e Membros Fundadores ganham 1 ano grátis.')}`
})

// ─────────────────────────── FACULDADES (B2B) ───────────────────────────
const CPT = [
  ['◎', 'Diagnóstico da turma', 'Médias de raciocínio e comunicação, pontos a fortalecer e evolução ao longo do tempo.'],
  ['▲', 'Indicadores pedagógicos', 'Coerência dos pedidos de exame, adequação das condutas e taxa de fechamento diagnóstico.'],
  ['↗', 'Engajamento', 'Quem está ativo, participação no desafio e uso dos simulados — para agir cedo.'],
  ['⌾', 'Ficha por aluno', 'O desempenho individual de cada estudante, com histórico de consultas.'],
]
const faculdades = page({
  title: 'Med Mind — para faculdades e ligas acadêmicas',
  desc: 'Um painel do coordenador com o diagnóstico pedagógico da turma: raciocínio, condutas, coerência de exames e engajamento. Traga sua turma para o Med Mind.',
  active: '/faculdades',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap" style="grid-template-columns:1fr">
      <div class="hero-copy" style="max-width:720px">
        <p class="eyebrow reveal d1">Para quem ensina</p>
        <h1 class="reveal d2">Acompanhe sua turma <span class="hl">de perto</span>.</h1>
        <p class="lead reveal d3" style="max-width:54ch">Um painel para coordenadores, ligas e cursinhos: o diagnóstico pedagógico da turma e de cada aluno — onde intervir e quem precisa de ajuda.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="/faculdades#contato">Falar com a gente →</a></div>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="coord-points">
        ${CPT.map(([ic, b, p]) => `<div class="cpt"><span class="ic">${ic}</span><b>${b}</b><p>${p}</p></div>`).join('\n        ')}
      </div>
      <div class="enamed">
        <span class="enamed-tag">Como funciona</span>
        <p>Cada turma tem um <b>código de convite</b>. Os alunos entram com o código e passam a aparecer no painel da instituição — sem trabalho manual. O coordenador vê apenas os alunos da sua turma.</p>
      </div>
    </div>
  </section>

  <section class="band" id="contato">
    <div class="wrap">
      <div class="sec-head"><span class="kicker">Contato</span><h2>Leve o Med Mind para a sua instituição.</h2><p>Fale com a gente para liberar o painel do coordenador para a sua turma, liga ou cursinho.</p></div>
      <div class="contact">
        <a class="contact-card" href="mailto:contato@medmindedu.com.br">
          <span class="cc-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></span>
          <span><b>E-mail</b><span>contato@medmindedu.com.br</span></span>
        </a>
      </div>
    </div>
  </section>

  ${finalCta('Traga sua turma para o Med Mind.', 'Fale com a gente e libere o painel do coordenador para a sua instituição.', 'Falar com a gente →', 'mailto:contato@medmindedu.com.br')}`
})

// ─────────────────────────── escrever ───────────────────────────
mkdirSync('public/site', { recursive: true })
writeFileSync('public/landing.html', home, 'utf8')
writeFileSync('public/site/simulador.html', simulador, 'utf8')
writeFileSync('public/site/comunidade.html', comunidade, 'utf8')
writeFileSync('public/site/simulados.html', simulados, 'utf8')
writeFileSync('public/site/faculdades.html', faculdades, 'utf8')
console.log('site gerado: landing.html + site/{simulador,comunidade,simulados,faculdades}.html')
