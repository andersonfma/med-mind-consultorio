# Ferramentas E Limitacoes

Atualizado em: 2026-05-18

## Ambiente Atual

Diretorio do projeto:

```text
C:\Users\ander\OneDrive\Documentos\Consultóio Vivo
```

Estado inicial:

- repositorio Git existe;
- ainda nao ha commits;
- documentacao-base foi criada;
- ainda nao ha stack de aplicacao instalada.

## Runtime Disponivel Pelo Codex

O ambiente do Codex disponibiliza Node.js empacotado em:

```text
C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

Tambem ha Python empacotado em:

```text
C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
```

Isso permite executar scripts locais pontuais, validadores e ferramentas simples.

## Limitacoes Detectadas

- `npm` nao esta disponivel no PATH atual.
- `node` global respondeu com acesso negado no shell padrao.
- Downloads de dependencias pela internet podem exigir autorizacao.
- Deploy, banco hospedado e integracoes externas exigirao credenciais do usuario.
- OpenAI API, Supabase, Vercel, Stripe, dominios e provedores similares exigirao
  chaves ou login externo.

## Implicacao Para O Proximo Passo

Antes de instalar Next.js, Prisma ou bibliotecas de UI/graficos, sera necessario:

1. usar um gerenciador de pacotes disponivel na maquina; ou
2. instalar/configurar Node.js e npm; ou
3. autorizar o Codex a baixar dependencias quando o comando falhar por rede/ambiente.

## O Que O Codex Consegue Fazer Agora Sem Dependencias

- criar documentacao;
- criar contratos;
- criar modelos conceituais;
- preparar arquivos de configuracao;
- escrever codigo fonte inicial;
- escrever testes conceituais ou scripts simples;
- usar o Node.js empacotado para validacoes locais que nao dependam de pacotes externos.

## Comandos De Verificacao Atuais

Testes:

```powershell
& 'C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Smoke demo:

```powershell
& 'C:\Users\ander\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/smoke.mjs
```

## O Que Exigira Preparacao Externa

- instalar dependencias;
- rodar servidor Next.js real;
- conectar banco hospedado;
- autenticar usuarios reais;
- configurar API de IA;
- publicar em ambiente externo;
- integrar com repositorio privado do Med Mind se estiver fora desta pasta.

## Recomendacao De Organizacao

Para reduzir perdas durante a evolucao para SaaS:

- usar Git/GitHub como fonte principal do codigo;
- manter Google Drive para documentos, referencias, PDFs, brainstorms e memoria
  estrategica;
- manter uma memoria minima dentro de `README.md` e `docs/`;
- evitar tratar Google Drive ou OneDrive como unico versionador de codigo;
- antes de grandes refatores, rodar testes e preferir commits pequenos.

Plugins/conectores recomendados no Codex:

- GitHub: versionamento, branches, PRs e recuperacao de mudancas;
- Google Drive: documentos de produto e referencias;
- OpenAI Developers: suporte a API, modelos e configuracao quando evoluirmos a
  IA.
