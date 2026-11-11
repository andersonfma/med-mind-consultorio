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
  { href: '/planos', label: 'Planos' },
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
      <a class="link" href="/planos" style="font-size:13px">Planos</a>
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

// mock do feed/rede social (→ comunidade)
const SOC_PHONE = `<div class="hero-visual reveal d3">
  <div class="soc-phone" role="img" aria-label="Prévia do feed e dos stories da comunidade Med Mind">
    <div class="soc-grip"></div>
    <div class="soc-top"><span class="t">Feed<i>.</i></span>
      <svg class="soc-bell" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
    </div>
    <div class="soc-stories">
      <div class="soc-st"><span class="soc-rg own"><img src="https://i.pravatar.cc/112?img=5" alt=""><b class="addbadge">+</b></span><span>Seu story</span></div>
      <div class="soc-st"><span class="soc-rg"><img src="https://i.pravatar.cc/112?img=47" alt=""></span><span>Fernanda</span></div>
      <div class="soc-st"><span class="soc-rg"><img src="https://i.pravatar.cc/112?img=12" alt=""></span><span>Lucas</span></div>
      <div class="soc-st"><span class="soc-rg"><img src="https://i.pravatar.cc/112?img=32" alt=""></span><span>Marina</span></div>
      <div class="soc-st"><span class="soc-rg seen"><img src="https://i.pravatar.cc/112?img=68" alt=""></span><span>Pedro</span></div>
    </div>
    <div class="soc-post">
      <div class="soc-ph"><img class="soc-av" src="https://i.pravatar.cc/80?img=47" alt=""><div><div class="n">Ana Costa</div><div class="h">@ana.costa · Cardiologia</div></div><span class="tm">há 12 min</span></div>
      <div class="soc-card">
        <div class="soc-card-top"><svg class="mk" viewBox="0 0 32 32"><use href="#mm"/></svg><span class="wm">Med<b>Mind</b></span><span class="soc-badge">Caso concluído</span></div>
        <div class="soc-dx">Amiloidose cardíaca</div>
        <div class="soc-stats"><div class="soc-stat"><div class="l">Raciocínio</div><div class="v">8.4<em>/10</em></div></div><div class="soc-stat"><div class="l">Dificuldade</div><div class="v">Difícil</div></div><div class="soc-stat"><div class="l">MedCoin</div><div class="v" style="color:var(--cyan)">+25</div></div></div>
      </div>
      <p class="soc-cap">Fechei o caso! Que diagnóstico traiçoeiro</p>
      <div class="soc-react"><span class="hot">♥ 24</span><span>💬 6</span><span class="sh">↗ Compartilhar</span></div>
    </div>
    <div class="soc-sep"></div>
    <div class="soc-post">
      <div class="soc-ph"><img class="soc-av" src="https://i.pravatar.cc/80?img=12" alt=""><div><div class="n">Lucas Ribeiro</div><div class="h">@lucas.rib · 5º período</div></div><span class="tm">há 40 min</span></div>
      <div class="soc-ecg" style="position:relative" role="img" aria-label="Traçado de ECG">
        <svg viewBox="0 0 300 150" preserveAspectRatio="none"><polyline fill="none" stroke="#FF6E86" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="0,96 6,95 12,98 18,96 21,96 22,104 24,44 26,108 28,96 34,95 40,98 46,96 52,95 58,98 59,96 60,104 61,44 62,108 63,96 69,95 75,98 81,96 82,96 83,105 84,45 85,108 86,96 92,95 98,98 104,96 110,95 116,98 122,96 128,96 129,104 130,43 131,108 132,96 138,95 144,98 150,96 151,105 152,45 153,108 154,96 160,95 166,98 172,96 178,95 184,98 190,96 196,96 197,104 198,44 199,108 200,96 206,95 212,98 218,96 224,95 230,98 234,96 235,104 236,44 237,108 238,96 244,95 250,98 256,96 262,95 268,98 272,96 273,105 274,45 275,108 276,96 282,96 288,95 294,98 300,96"/></svg>
        <span class="tag">ECG · 25 mm/s</span>
      </div>
      <p class="soc-cap">Qual a conduta nesse ECG? Pulso irregular</p>
      <div class="soc-react"><span class="hot">♥ 31</span><span>💬 9</span><span class="sh">↗ Compartilhar</span></div>
      <div class="soc-cmt"><img src="https://i.pravatar.cc/60?img=32" alt=""><span class="cb"><b>Marina Alves</b> FA! Avalia estabilidade e anticoagulação</span><span class="cl">♥ 7</span></div>
    </div>
    <div class="soc-chal"><span class="em">🎯</span><div><div class="n">Desafio de hoje · Síntese</div><div class="s">Aposte seus MedCoins no palpite</div></div><span class="go">responder</span></div>
  </div>
</div>`

// painel do coordenador (→ faculdades)
const COORD_DASH = `<div class="coord-dash" aria-label="Prévia do painel do coordenador">
  <div class="cd-h"><span class="cd-t">Painel do coordenador</span><span class="cd-badge">turma 2026.1 · 42 alunos</span></div>
  <div class="cd-kpis">
    <div class="cd-kpi"><div class="k">Alunos</div><div class="v">42</div></div>
    <div class="cd-kpi"><div class="k">Ativos 7d</div><div class="v">34</div></div>
    <div class="cd-kpi"><div class="k">Pacientes</div><div class="v">120</div></div>
    <div class="cd-kpi"><div class="k">Consultas</div><div class="v">168</div></div>
    <div class="cd-kpi"><div class="k">Conclusão</div><div class="v">85%</div></div>
    <div class="cd-kpi"><div class="k">Simulados</div><div class="v">76</div></div>
  </div>
  <div class="cd-grid2">
    <div class="cd-panel">
      <div class="cd-pt"><span class="t">Raciocínio — média da turma</span><span class="n">4.9<s>/10</s></span></div>
      <div class="cd-row"><span class="l">Hipóteses</span><div class="cd-track"><div class="cd-fill" style="width:47%;background:var(--green)"></div></div><span class="cd-val">4.7</span></div>
      <div class="cd-row"><span class="l">Plausibilidade</span><div class="cd-track"><div class="cd-fill" style="width:57%;background:var(--green)"></div></div><span class="cd-val">5.7</span></div>
      <div class="cd-row"><span class="l">Diferencial</span><div class="cd-track"><div class="cd-fill" style="width:41%;background:var(--amber)"></div></div><span class="cd-val">4.1</span></div>
      <div class="cd-row"><span class="l">Fechamento</span><div class="cd-track"><div class="cd-fill" style="width:42%;background:var(--amber)"></div></div><span class="cd-val">4.2</span></div>
    </div>
    <div class="cd-panel">
      <div class="cd-pt"><span class="t">Comunicação — média da turma</span><span class="n">4.8<s>/10</s></span></div>
      <div class="cd-row"><span class="l">Clareza</span><div class="cd-track"><div class="cd-fill" style="width:54%;background:var(--coral)"></div></div><span class="cd-val">5.4</span></div>
      <div class="cd-row"><span class="l">Empatia</span><div class="cd-track"><div class="cd-fill" style="width:46%;background:var(--coral)"></div></div><span class="cd-val">4.6</span></div>
      <div class="cd-row"><span class="l">Condução</span><div class="cd-track"><div class="cd-fill" style="width:43%;background:var(--coral)"></div></div><span class="cd-val">4.3</span></div>
    </div>
  </div>
  <div class="cd-grid3">
    <div class="cd-ind"><div class="big" style="color:var(--coral)">17%</div><div class="lbl">Exames recusados por incoerência</div></div>
    <div class="cd-ind"><div class="big" style="color:var(--coral)">17%</div><div class="lbl">Condutas inadequadas</div></div>
    <div class="cd-ind"><div class="big" style="color:var(--amber)">32%</div><div class="lbl">Chegaram ao diagnóstico</div></div>
  </div>
  <div class="cd-actions"><span class="cd-btn primary">↓ Relatório da turma</span><span class="cd-btn ghost">↓ Relatórios individuais</span></div>
</div>`

// card de avaliação AB4 (→ simulador)
const SCORECARD = `<div class="scorecard" role="img" aria-label="Prévia da avaliação de uma consulta">
  <div class="sc-head"><div><div class="sc-name">Marília, 54 · Hepatologia</div><div class="sc-sub">Consulta finalizada</div></div><span class="pill">avaliação</span></div>
  <div class="sc-block"><h4>Raciocínio clínico — AB4</h4>
    <div class="bar-row"><span class="bar-lbl">Hipóteses</span><div class="bar-track"><div class="bar-fill" style="width:82%"></div></div><span class="bar-val">8.2</span></div>
    <div class="bar-row"><span class="bar-lbl">Plausibilidade</span><div class="bar-track"><div class="bar-fill" style="width:74%"></div></div><span class="bar-val">7.4</span></div>
    <div class="bar-row"><span class="bar-lbl">Diferencial</span><div class="bar-track"><div class="bar-fill" style="width:68%"></div></div><span class="bar-val">6.8</span></div>
    <div class="bar-row"><span class="bar-lbl">Fechamento</span><div class="bar-track"><div class="bar-fill" style="width:79%"></div></div><span class="bar-val">7.9</span></div>
  </div>
  <div class="sc-block"><h4>Comunicação</h4>
    <div class="bar-row"><span class="bar-lbl">Clareza</span><div class="bar-track"><div class="bar-fill coral" style="width:85%"></div></div><span class="bar-val">8.5</span></div>
    <div class="bar-row"><span class="bar-lbl">Empatia</span><div class="bar-track"><div class="bar-fill coral" style="width:76%"></div></div><span class="bar-val">7.6</span></div>
  </div>
  <div class="sc-overall"><span class="n">7.6</span><span class="d">/10 geral</span></div>
</div>`

// mock de questão de simulado (→ simulados)
const SIM_MOCK = `<div class="hero-visual reveal d3">
  <div style="max-width:430px;margin-inline:auto;background:linear-gradient(185deg,#15222D,#0B1219);border:1px solid var(--line-strong);border-radius:22px;padding:18px;box-shadow:0 36px 90px -44px #000">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px">
      <span style="font-family:var(--font-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#E7B23A;border:1px solid rgba(231,178,58,.4);border-radius:999px;padding:3px 9px">ENARE · Clínica Médica</span>
      <span style="font-size:11px;color:var(--muted-2)">Questão 3 / 10</span>
    </div>
    <p style="font-size:13px;color:var(--fog);line-height:1.55;margin:0 0 13px">Homem, 62 anos, com dispneia progressiva e edema de membros. Exame: turgência jugular, B3 e estertores bibasais; ECG com bloqueio de ramo esquerdo. Qual a conduta inicial mais apropriada?</p>
    <div style="display:flex;flex-direction:column;gap:7px;font-size:12.5px">
      <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--muted)"><b style="color:var(--fog)">A.</b> Betabloqueador IV em dose plena</div>
      <div style="border:1px solid var(--green);background:rgba(52,229,160,.1);border-radius:10px;padding:10px 12px;color:var(--fog)"><b>B.</b> Diurético de alça + IECA e investigação da IC</div>
      <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--muted)"><b style="color:var(--fog)">C.</b> Reposição volêmica agressiva</div>
      <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--muted)"><b style="color:var(--fog)">D.</b> Alta com retorno ambulatorial</div>
    </div>
    <p style="margin:12px 0 0;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:11.5px;color:var(--muted);line-height:1.5"><b style="color:var(--fog)">Gabarito (B).</b> Insuficiência cardíaca descompensada — o diurético alivia a congestão; betabloqueador IV é contraindicado na descompensação (distrator clássico).</p>
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
    <div class="wrap" style="max-width:820px">
      <span class="kicker">A origem</span>
      <h2 style="font-size:clamp(26px,4vw,40px);margin-top:12px">De onde vem a nossa metodologia?</h2>
      <p style="color:var(--muted);font-size:17px;line-height:1.7;margin-top:18px">Há mais de dois mil anos, Aristóteles descreveu as formas como o pensamento humano se move: o <b style="color:var(--fog)">poético</b>, que imagina e abre possibilidades; o <b style="color:var(--fog)">retórico</b>, que organiza e hierarquiza; o <b style="color:var(--fog)">dialético</b>, que confronta e testa; e o <b style="color:var(--fog)">analítico</b>, que demonstra e conclui.</p>
      <p style="color:var(--muted);font-size:17px;line-height:1.7;margin-top:16px">A medicina sempre fez exatamente isso — só que sem nome. O Med Mind nasce de um <b style="color:var(--fog)">trabalho original de filosofia da medicina</b> que traduz esses quatro modos do pensamento nas quatro fases do raciocínio clínico. É o que chamamos de <span style="color:var(--cyan);font-weight:600">método AB4</span> — e é com ele que avaliamos, pela primeira vez, não o que você respondeu, mas <i>como você pensou</i>.</p>
    </div>
  </section>

  <section class="band" style="padding-top:0">
    <div class="wrap" style="max-width:820px">
      <span class="kicker">A avaliação</span>
      <h2 style="font-size:clamp(24px,3.6vw,34px);margin-top:12px">Um método que enxerga o seu raciocínio, fase por fase.</h2>
      <p style="color:var(--muted);font-size:17px;line-height:1.7;margin-top:18px">Fundamentado nas quatro fases do pensamento aplicadas à clínica, o simulador avalia o caminho completo — e não apenas o destino. Ele reconhece se você <b style="color:var(--fog)">abriu bem o caso</b>, se <b style="color:var(--fog)">organizou hipóteses</b> com prioridade, se <b style="color:var(--fog)">testou</b> a hipótese contra alternativas em vez de só confirmá-la, e se <b style="color:var(--fog)">fechou</b> com uma justificativa sólida. Assim você descobre exatamente em que fase do raciocínio pode evoluir.</p>
      <div class="ab4-closed" style="margin-top:28px"><b>Mais comunicação.</b><p>Além do AB4, cada consulta avalia a sua comunicação com o paciente — clareza, empatia e escuta.</p></div>
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="feat">
        <div>
          <span class="kicker">O resultado</span>
          <h2 style="font-size:clamp(26px,3.6vw,36px);margin-top:12px">Uma avaliação clara ao fim de cada consulta.</h2>
          <p style="color:var(--muted);font-size:16px;margin-top:14px;max-width:44ch">Notas por critério, um radar de desempenho e um card para compartilhar. Você vê exatamente onde evoluiu e o que fortalecer.</p>
          <div class="hero-cta" style="margin-top:22px"><a class="btn btn-ghost" href="${REGISTER}">Ver a minha avaliação →</a></div>
        </div>
        ${SCORECARD}
      </div>
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
    <div class="wrap">
      <div class="hero-copy">
        <p class="eyebrow reveal d1">A comunidade</p>
        <h1 class="reveal d2">Estudar medicina deixou de ser <span class="hl">solitário</span>.</h1>
        <p class="lead reveal d3">Um feed para trocar casos e dúvidas, stories, um desafio clínico todo dia e um ranking para disputar com a turma.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="${REGISTER}">Entrar na comunidade →</a></div>
      </div>
      ${SOC_PHONE}
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
    <div class="wrap">
      <div class="hero-copy">
        <p class="eyebrow reveal d1" style="color:#E7B23A">Premium · Estudo de prova</p>
        <h1 class="reveal d2">Simulados de <span class="hl">ENARE e ENAMED</span>, por IA.</h1>
        <p class="lead reveal d3">Questões originais geradas por IA <b style="color:var(--fog)">nos moldes das provas</b> — vinheta clínica, dificuldade de residência e gabarito comentado. Por área, quantas quiser.</p>
        <div class="hero-cta reveal d4"><a class="btn btn-primary" href="${REGISTER}">Começar a treinar →</a></div>
      </div>
      ${SIM_MOCK}
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

  <section class="band" style="padding-top:0">
    <div class="wrap">
      ${COORD_DASH}
    </div>
  </section>

  <section class="band" style="padding-top:0">
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

// ─────────────────────────── PLANOS ───────────────────────────
const CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:2px" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
const feats = (items) => `<ul style="list-style:none;margin:20px 0 0;padding:0;display:flex;flex-direction:column;gap:11px">${items.map(t => `<li style="display:flex;gap:10px;font-size:14.5px;color:var(--muted);line-height:1.5"><span style="color:var(--cyan)">${CHECK}</span><span>${t}</span></li>`).join('')}</ul>`

function plan({ name, tagline, price, sub, items, cta, href, featured = false, accent = 'var(--cyan)' }) {
  return `<div class="card" style="display:flex;flex-direction:column;${featured ? `border-color:${accent};box-shadow:0 30px 70px -40px ${accent}66;position:relative` : ''}">
    ${featured ? `<span style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:${accent};color:#04191A;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:4px 12px">Mais escolhido</span>` : ''}
    <div class="k" style="${featured ? `color:${accent}` : ''}">${name}</div>
    <h3 style="font-size:19px;margin:2px 0 0">${tagline}</h3>
    <div style="margin-top:16px;display:flex;align-items:baseline;gap:7px">
      <span style="font-family:var(--font-display,inherit);font-size:38px;font-weight:700;color:var(--fog);line-height:1">${price}</span>
      ${sub ? `<span style="font-size:14px;color:var(--muted)">${sub}</span>` : ''}
    </div>
    ${feats(items)}
    <div style="flex:1"></div>
    <a class="btn ${featured ? 'btn-primary' : 'btn-ghost'}" href="${href}" style="margin-top:24px;width:100%;text-align:center;justify-content:center">${cta}</a>
  </div>`
}

const planos = page({
  title: 'Med Mind — Planos e preços',
  desc: 'Comece grátis. O Premium libera casos e especialidades ilimitados, consultas de IA sem limite e os simulados de ENARE/ENAMED. Mensal R$ 29 ou anual R$ 229.',
  active: '/planos',
  body: `<section class="hero">
    <div class="stripes"></div>
    <div class="wrap" style="grid-template-columns:1fr">
      <div class="hero-copy" style="max-width:720px;text-align:center;margin-inline:auto">
        <p class="eyebrow reveal d1">Planos</p>
        <h1 class="reveal d2">Comece grátis. <span class="hl">Evolua</span> quando quiser.</h1>
        <p class="lead reveal d3" style="margin-inline:auto">O essencial do Med Mind é gratuito para sempre. O Premium tira os limites e libera os simulados de ENARE e ENAMED.</p>
      </div>
    </div>
  </section>

  <section class="band" style="padding-top:0">
    <div class="wrap">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:18px;align-items:stretch;max-width:960px;margin-inline:auto">
        ${plan({
          name: 'Grátis', tagline: 'Para começar', price: 'R$ 0', sub: 'para sempre',
          items: ['Comunidade completa: feed, stories e ranking', 'Desafio da semana com quiz e MedCoins', '5 casos por mês em 2 especialidades'],
          cta: 'Criar conta grátis →', href: REGISTER,
        })}
        ${plan({
          name: 'Premium', tagline: 'Para treinar sem limites', price: 'R$ 29', sub: '/mês',
          items: ['Todas as 9 especialidades clínicas', 'Casos e consultas de IA ilimitados', 'Simulados de ENARE e ENAMED por IA', 'Selo Premium no seu perfil', 'Tudo do plano grátis'],
          cta: 'Assinar Premium →', href: REGISTER, featured: true,
        })}
        ${plan({
          name: 'Fundador', tagline: 'Para os primeiros e para turmas', price: '1 ano', sub: 'grátis',
          items: ['Tudo do Premium, por 12 meses', 'Para os 50 primeiros usuários ativos', 'Ou com código de fundador (aulas e ligas)'],
          cta: 'Garantir minha vaga →', href: REGISTER, accent: '#E7B23A',
        })}
      </div>
      <div style="max-width:960px;margin:22px auto 0;text-align:center">
        <p style="font-size:14px;color:var(--muted)"><b style="color:var(--fog)">Anual: R$ 229/ano</b> — economize R$ 119 (mais de 3 meses grátis). A assinatura é feita dentro do app, com o checkout seguro da Hotmart.</p>
        <p style="font-size:12.5px;color:var(--muted-2);margin-top:10px">Pix, cartão ou boleto · cancele quando quiser · 7 dias de garantia.
          <a class="link" href="${LOGIN}" style="font-size:12.5px">Já tem conta? Entrar e assinar</a>
        </p>
      </div>
    </div>
  </section>

  <section class="band" style="padding-top:0">
    <div class="wrap" style="max-width:820px">
      <div class="sec-head"><span class="kicker">Perguntas frequentes</span><h2>Dúvidas comuns.</h2></div>
      <div class="aud" style="grid-template-columns:1fr 1fr">
        <div class="card"><h3>O plano grátis expira?</h3><p>Não. A comunidade, o desafio diário e os 5 casos mensais são gratuitos para sempre.</p></div>
        <div class="card"><h3>Posso cancelar quando quiser?</h3><p>Sim. O Premium é uma assinatura sem fidelidade — cancele a qualquer momento e mantenha o acesso até o fim do período.</p></div>
        <div class="card"><h3>Como funcionam os simulados?</h3><p>Questões originais geradas por IA nos moldes do ENARE e do ENAMED, por área, com gabarito comentado. Incluídas no Premium.</p></div>
        <div class="card"><h3>O que é ser Membro Fundador?</h3><p>Os primeiros usuários ativos — e turmas de aulas e ligas com um código — ganham 1 ano de Premium gratuito.</p></div>
      </div>
    </div>
  </section>

  ${finalCta('Comece agora — é grátis.', 'Crie sua conta em um minuto. O Premium está a um clique quando você quiser.')}`
})

// ─────────────────────────── escrever ───────────────────────────
mkdirSync('public/site', { recursive: true })
writeFileSync('public/landing.html', home, 'utf8')
writeFileSync('public/site/simulador.html', simulador, 'utf8')
writeFileSync('public/site/comunidade.html', comunidade, 'utf8')
writeFileSync('public/site/simulados.html', simulados, 'utf8')
writeFileSync('public/site/planos.html', planos, 'utf8')
writeFileSync('public/site/faculdades.html', faculdades, 'utf8')
console.log('site gerado: landing.html + site/{simulador,comunidade,simulados,planos,faculdades}.html')
