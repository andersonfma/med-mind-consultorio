// Fonte única da marca. Trocar o nome aqui propaga para todo o APP (títulos,
// manifesto, e-mails, wordmark). Fora do alcance desta constante — e que precisam
// ser trocados à parte num eventual rebrand:
//   - imagens (ícones do PWA, apple-touch-icon, cartão OG em PNG);
//   - domínio e e-mail (medmindedu.com.br) — ver constante `emailSender`;
//   - páginas estáticas de marketing em public/site/*.html (HTML puro);
//   - nomes de componentes/arquivos (MedMindMark etc.) — identificadores de código,
//     não texto de marca; não precisam mudar num rebrand.
export const BRAND = {
  name: 'Med Mind',            // nome exibido (com espaço)
  nameCompact: 'MedMind',      // sem espaço (ids, nome de fonte)
  prefix: 'Med',               // parte fixa do wordmark
  suffix: 'Mind',              // parte colorida do wordmark
  tagline: 'Simulador clínico',
  // Remetente dos e-mails. O domínio aqui é a peça operacional de risco num rebrand.
  emailSender: 'Med Mind <contato@medmindedu.com.br>',
} as const
