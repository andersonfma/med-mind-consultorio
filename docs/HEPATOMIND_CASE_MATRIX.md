# HepatoMind - Matriz Fisiopatologica de Casos

Atualizado em: 2026-05-16

## Objetivo

Esta matriz transforma o HepatoMind de um banco pequeno de casos escritos para um motor de diversidade clinica. O caso nao deve nascer de um diagnostico isolado. Deve nascer de uma perturbacao fisiopatologica, atravessar uma interface organica/especialidade e chegar ao aluno por uma apresentacao clinica plausivel.

Uso esperado:

- orientar geracao de casos simulados;
- evitar repeticao tematica precoce;
- preservar a fase poetica por meio de contexto narrativo;
- reduzir alucinacao ao ancorar cada caso em fisiopatogenese;
- criar sementes reutilizaveis para o futuro gerador via API/WhatsApp.

## Eixos da matriz

### Eixo 1 - Mecanismo fisiopatologico

- Lesao hepatocelular aguda
- Colestase intra-hepatica ou extra-hepatica
- Hipertensao portal
- Falencia sintetica
- Inflamacao/imunidade
- Metabolismo hepatico
- Eixo intestino-figado
- Eixo figado-rim
- Eixo figado-cerebro
- Eixo figado-pulmao/coracao
- Fluxo vascular/trombose
- Carcinogenese e lesoes focais

### Eixo 2 - Interface organica ou especialidade

- Rim/nefrologia
- Cerebro/neurologia/psiquiatria
- Pulmao/cardiologia
- Hematologia/coagulacao
- Endocrino/metabolico
- Imuno/reumatologia
- Infectologia
- Oncologia/radiologia
- Ginecologia/obstetricia
- Toxicologia/farmacologia
- Nutricao/geriatria
- Gastroenterologia/intestino

### Eixo 3 - Porta de entrada

- Ictericia
- Prurido
- Febre
- Dor abdominal
- Ascite/edema
- Hemorragia digestiva
- Alteracao cognitiva
- Alteracao assintomatica de exames
- Achado incidental em imagem
- Perda ponderal/fadiga/anorexia
- Dispneia/hipoxemia
- Injura renal/oliguria
- Alteracao hematologica
- Gravidez/puerperio
- Pre-operatorio/risco clinico

### Eixo 4 - Armadilha cognitiva

- Fechamento precoce por diagnostico comum
- Atribuir tudo a cirrose conhecida
- Ignorar medicamento, suplemento ou fitoterapico
- Confundir colestase com alergia/dermatologia
- Confundir infeccao com apenas encefalopatia
- Ler plaqueta/INR como coagulacao linear
- Tratar nodule incidental como cancer sem protocolo
- Tratar MASLD como diagnostico de exclusao automatico
- Desconsiderar interface renal, cardiaca ou pulmonar
- Ignorar red flags de transplante/centro especializado

## Regras de diversidade

1. Nao repetir o mesmo mecanismo fisiopatologico em casos consecutivos.
2. Nao repetir a mesma interface organica em casos consecutivos.
3. Nao repetir a mesma porta de entrada em casos consecutivos.
4. Em uma janela de 10 casos, incluir pelo menos 5 interfaces organicas diferentes.
5. Em uma janela de 10 casos, incluir pelo menos 6 mecanismos diferentes.
6. No modo Mestre, pelo menos metade dos casos devem envolver interface extra-hepatica relevante.
7. No modo Intermediario, evitar excesso de diagnosticos raros; complexidade deve vir mais da organizacao do raciocinio.
8. No modo Avancado/Mestre, cada caso deve ter pelo menos uma armadilha cognitiva explicita no desenho interno, mas nao revelada ao aluno.
9. Casos com prurido nao devem colapsar automaticamente em doenca colestatica no caso seguinte.
10. Casos de cirrose nao devem ocupar mais de 30% de uma sequencia recente.

## Estrutura minima de cada caso gerado

Cada caso deve conter:

- Cena inicial com personagem, contexto, motivo de chegada e tensao narrativa.
- Anamnese dirigida com HPP, medicamentos, suplementos, alcool, epidemiologia, historia familiar e negativos relevantes.
- Exame fisico completo o suficiente para a porta de entrada.
- Exames iniciais coerentes com o mecanismo.
- Uma ou mais pistas que aumentam probabilidade.
- Uma ou mais pistas que reduzem probabilidade ou criam diferencial.
- Desafio final padronizado.

## Arquetipos de casos

| ID | Mecanismo | Interface | Porta de entrada | Armadilha cognitiva | Campo diagnostico possivel | Complexidade |
|---|---|---|---|---|---|---|
| HM-001 | Lesao hepatocelular aguda | Infectologia | Ictericia | Chamar toda transaminase alta de viral | Hepatites virais, DILI, autoimune, isquemica | Intermediario |
| HM-002 | Lesao hepatocelular aguda | Toxicologia/farmacologia | Ictericia + sonolencia | Subestimar medicamento OTC/fitoterapico | DILI, paracetamol, hepatite viral, autoimune | Avancado |
| HM-003 | Lesao hepatocelular aguda | Imuno/reumatologia | Ictericia + artralgia | Esperar autoanticorpo antes de reconhecer gravidade | Hepatite autoimune, viral, DILI | Mestre |
| HM-004 | Lesao hepatocelular aguda | Cardiologia | TGO/TGP muito altas + choque | Nao pensar em hipoperfusao | Hepatite isquemica, congestiva, DILI | Avancado |
| HM-005 | Lesao hepatocelular aguda | Obstetricia | Puerperio + dor abdominal | Atribuir a dor pos-parto comum | AFLP, HELLP, Budd-Chiari, hepatite viral | Mestre |
| HM-006 | Lesao hepatocelular aguda | Hematologia | Ictericia + anemia | Confundir bilirrubina indireta com lesao hepatica primaria | Hemolise, Wilson, hepatite grave | Mestre |
| HM-007 | Colestase | Imuno/reumatologia | Prurido | Tratar como alergia cronica | PBC/CBP, PSC/CEP, DILI colestatico, obstrucao | Intermediario |
| HM-008 | Colestase | Gastroenterologia/intestino | Febre + ictericia | Nao reconhecer risco infeccioso biliar | Colangite, PSC, obstrucao, DILI | Mestre |
| HM-009 | Colestase | Oncologia/radiologia | Ictericia indolor | Fechar em pedra sem avaliar neoplasia | Colangiocarcinoma, neoplasia pancreatobiliar, coledocolitiase | Avancado |
| HM-010 | Colestase | Farmacologia | Prurido + FA/GGT altas | Esquecer antibiotico/anabolizante | DILI colestatico, PBC, obstrucao | Avancado |
| HM-011 | Colestase | Obstetricia | Prurido gestacional | Ignorar risco fetal e diferenciais | Colestase intra-hepatica da gestacao, HELLP, viral | Avancado |
| HM-012 | Colestase | Imuno/reumatologia | Fadiga + overlap laboratorial | Separar rigidamente PBC e HAI | Overlap, PBC, HAI, DILI | Mestre |
| HM-013 | Hipertensao portal | Gastroenterologia | Hematemese | Tratar como gastrite/ulcera comum | Varizes, ulcera, gastropatia portal | Avancado |
| HM-014 | Hipertensao portal | Hematologia | Plaquetopenia isolada | Investigar so medula e esquecer esplenomegalia | Cirrose, trombose portal, hiperesplenismo | Intermediario |
| HM-015 | Hipertensao portal | Rim/nefrologia | Ascite + oliguria | Tratar como desidratacao simples | HRS-AKI, IRA pre-renal, PBE, nefrotoxicidade | Mestre |
| HM-016 | Hipertensao portal | Pulmao/cardiologia | Dispneia em cirrotico | Ignorar sindromes pulmonares vasculares | Hepatopulmonar, portopulmonar, derrame hepatico | Mestre |
| HM-017 | Hipertensao portal | Vascular/hematologia | Dor abdominal + esplenomegalia | Assumir cirrose sem procurar trombose | Trombose portal, neoplasia mieloproliferativa | Mestre |
| HM-018 | Hipertensao portal | Nutricao/geriatria | Fraqueza + quedas | Ignorar sarcopenia como prognostico | Cirrose fragil, desnutricao, encefalopatia minima | Avancado |
| HM-019 | Falencia sintetica | Emergencia | INR alto + ictericia | Confundir INR com anticoagulacao isolada | Falencia hepatica aguda, DILI, viral, Wilson | Mestre |
| HM-020 | Falencia sintetica | Hematologia | Sangramento + INR alto | Corrigir numero sem entender contexto | Cirrose, falencia aguda, coagulopatia reequilibrada | Avancado |
| HM-021 | Falencia sintetica | Nutricao | Albumina baixa + edema | Atribuir apenas a figado | Sindrome nefrotica, enteropatia perdedora, cirrose | Intermediario |
| HM-022 | Falencia sintetica | Infectologia | Sepse + piora INR | Nao reconhecer ACLF | ACLF, PBE, pneumonia, ITU, DILI | Mestre |
| HM-023 | Falencia sintetica | Obstetricia | Gestante com plaqueta baixa | Nao integrar figado e placenta | HELLP, AFLP, PTT, hepatite viral | Mestre |
| HM-024 | Falencia sintetica | Oncologia | Perda ponderal + albumina baixa | Atribuir tudo a cirrose | HCC, colangiocarcinoma, neoplasia extra-hepatica | Avancado |
| HM-025 | Inflamacao/imunidade | Reumatologia | Fadiga + artralgia + transaminases | Nao perguntar autoimunidade | HAI, overlap, lupus, DILI | Avancado |
| HM-026 | Inflamacao/imunidade | Infectologia | Febre prolongada + hepatograma | Fechar em virose inespecifica | EBV/CMV, hepatites, abscesso, TB | Avancado |
| HM-027 | Inflamacao/imunidade | Gastroenterologia | DII + colestase | Nao conectar intestino e via biliar | PSC/CEP, DILI, colangite | Avancado |
| HM-028 | Inflamacao/imunidade | Imuno/IgG4 | Ictericia + pancreas/biliar | Confundir com cancer sem integrar IgG4 | Colangite IgG4, neoplasia, PSC | Mestre |
| HM-029 | Inflamacao/imunidade | Dermatologia | Prurido + xantelasmas | Focar so pele | PBC, colestase cronica, dislipidemia secundaria | Intermediario |
| HM-030 | Inflamacao/imunidade | Nefrologia | Proteinuria + hepatite | Nao lembrar crioglobulinemia/vasculite | HCV, vasculite, glomerulonefrite | Mestre |
| HM-031 | Metabolismo hepatico | Endocrino | Esteatose + diabetes | Chamar de MASLD e parar | MASLD/MASH, alcool, DILI, hemocromatose | Intermediario |
| HM-032 | Metabolismo hepatico | Hematologia | Ferritina alta | Confundir inflamacao com sobrecarga de ferro | Hemocromatose, MASLD, alcool, inflamacao | Avancado |
| HM-033 | Metabolismo hepatico | Neurologia | Jovem com tremor + hepatite | Pensar so psiquiatria | Wilson, DILI, viral, autoimune | Mestre |
| HM-034 | Metabolismo hepatico | Endocrino | Hipogonadismo + transaminases | Ignorar ferro/cobre/metabolico | Hemocromatose, MASLD, alcool | Avancado |
| HM-035 | Metabolismo hepatico | Pediatria/adulto jovem | Colestase/neurologico | Tratar como hepatite comum | Wilson, A1AT, autoimune | Mestre |
| HM-036 | Metabolismo hepatico | Cardiologia | Cardiomiopatia + ferritina alta | Separar coracao e figado | Hemocromatose, alcool, MASLD | Mestre |
| HM-037 | Eixo intestino-figado | Gastroenterologia | Dor abdominal + diarreia + colestase | Nao conectar DII e figado | PSC, DILI, colangite, abscesso | Avancado |
| HM-038 | Eixo intestino-figado | Infectologia | Cirrose + febre sem foco | Nao fazer paracentese mentalmente | PBE, bacteremia, pneumonia, ITU | Avancado |
| HM-039 | Eixo intestino-figado | Nutricao | Sarcopenia + ascite | Tratar so com diuretico | Cirrose descompensada, desnutricao, fragilidade | Avancado |
| HM-040 | Eixo intestino-figado | Microbiota/infeccao | Encefalopatia recorrente | Ignorar constipacao e infeccao | HE, PBE, sedativo, sangramento | Intermediario |
| HM-041 | Eixo intestino-figado | Cirurgia | Pos-bariatrica + hepatograma | Nao pensar em desnutricao/DILI | MASLD, desnutricao, DILI, alcool | Avancado |
| HM-042 | Eixo intestino-figado | Oncologia | Lesoes hepaticas + tumor intestinal | Tratar toda lesao como HCC | Metastase, HCC, hemangioma | Intermediario |
| HM-043 | Eixo figado-rim | Nefrologia | Cirrose + creatinina subindo | Assumir HRS cedo demais | HRS-AKI, PBE, pre-renal, ATN, nefrotoxico | Mestre |
| HM-044 | Eixo figado-rim | Emergencia | Hiponatremia + confusao | Atribuir tudo a encefalopatia | Hiponatremia, HE, infeccao, sedativo | Avancado |
| HM-045 | Eixo figado-rim | Farmacologia | Ascite + diuretico + IRA | Nao revisar medicamentos | Diuretico, AINE, HRS, PBE | Avancado |
| HM-046 | Eixo figado-rim | Infectologia | Febre + IRA no cirrotico | Esquecer infeccao oculta | PBE, ITU, pneumonia, HRS | Mestre |
| HM-047 | Eixo figado-rim | Hematologia | Hematuria/proteinuria + hepatite | Nao pensar vasculite viral | HCV, crioglobulinemia, GN | Mestre |
| HM-048 | Eixo figado-rim | Pre-operatorio | Cirrose + risco renal | Focar apenas no MELD | Cirrose, HRS risk, contrast nephropathy | Avancado |
| HM-049 | Eixo figado-cerebro | Neurologia | Confusao aguda | Diagnosticar HE sem buscar gatilho | HE, sepse, sangramento, hiponatremia, sedativo | Intermediario |
| HM-050 | Eixo figado-cerebro | Psiquiatria | Mudanca comportamental jovem | Tratar como transtorno primario | Wilson, falencia hepatica, toxico | Mestre |
| HM-051 | Eixo figado-cerebro | Emergencia | Sonolencia + INR alto | Nao reconhecer falencia aguda | ALF, DILI, viral, Wilson | Mestre |
| HM-052 | Eixo figado-cerebro | Geriatria | Quedas + lentificacao | Ignorar encefalopatia minima/sarcopenia | HE minima, sedativo, fragilidade | Avancado |
| HM-053 | Eixo figado-cerebro | Infectologia | Delirium + febre | Atribuir so a HE | Sepse, PBE, pneumonia, HE | Avancado |
| HM-054 | Eixo figado-cerebro | Farmacologia | Cirrotico + benzodiazepinico | Nao revisar prescricao | HE medicamentosa, infeccao, hiponatremia | Intermediario |
| HM-055 | Eixo figado-pulmao/coracao | Pneumologia | Dispneia + ortodeoxia | Tratar como DPOC | Sindrome hepatopulmonar, derrame, IC | Mestre |
| HM-056 | Eixo figado-pulmao/coracao | Cardiologia | Edema + hepatomegalia | Chamar de cirrose primaria | Congestao hepatica, IC direita, Budd-Chiari | Avancado |
| HM-057 | Eixo figado-pulmao/coracao | Pneumologia | Hipertensao pulmonar + cirrose | Nao integrar porto-pulmonar | Hipertensao portopulmonar, HPS, IC | Mestre |
| HM-058 | Eixo figado-pulmao/coracao | Emergencia | Derrame pleural direito | Tratar como pneumonia isolada | Hidrotorax hepatico, pneumonia, IC | Avancado |
| HM-059 | Eixo figado-pulmao/coracao | Cardiologia | TGO/TGP altas + congestao | Confundir com hepatite viral | Hepatopatia congestiva, isquemica, DILI | Avancado |
| HM-060 | Eixo figado-pulmao/coracao | Pre-transplante | Dispneia no candidato | Ignorar impacto em elegibilidade | HPS, portopulmonar, IC | Mestre |
| HM-061 | Fluxo vascular/trombose | Hematologia | Dor abdominal + ascite rapida | Pensar so em colecistite | Budd-Chiari, trombose portal, neoplasia | Mestre |
| HM-062 | Fluxo vascular/trombose | Obstetricia | Puerperio + dor HCD | Nao lembrar hipercoagulabilidade | Budd-Chiari, HELLP, AFLP | Mestre |
| HM-063 | Fluxo vascular/trombose | Hematologia | Eritrocitose + trombose portal | Nao procurar mieloproliferativa | PV/MPN, trombose portal | Mestre |
| HM-064 | Fluxo vascular/trombose | Oncologia | Trombose portal + lesao | Confundir trombo tumoral e bland thrombus | HCC, trombose portal, cirrose | Mestre |
| HM-065 | Fluxo vascular/trombose | Gastroenterologia | Dor pos-prandial + portal/mesenterica | Atrasar reconhecimento mesenterico | Trombose portomesenterica | Mestre |
| HM-066 | Fluxo vascular/trombose | Farmacologia | Hormonal + dor HCD | Nao perguntar estrogenio/anabolizante | Budd-Chiari, adenoma, DILI | Avancado |
| HM-067 | Carcinogenese/lesoes focais | Radiologia | Nodulo incidental | Pular protocolo dinamico | Hemangioma, FNH, adenoma, HCC | Intermediario |
| HM-068 | Carcinogenese/lesoes focais | Oncologia | Perda ponderal + massa | Assumir HCC sem contexto | HCC, colangiocarcinoma, metastase | Avancado |
| HM-069 | Carcinogenese/lesoes focais | Ginecologia | Mulher jovem + nodulo | Ignorar hormonio/adenoma | Adenoma, FNH, hemangioma, HCC raro | Avancado |
| HM-070 | Carcinogenese/lesoes focais | Radiologia | LI-RADS indeterminado | Forcar diagnostico sem qualidade de imagem | HCC, displasia, arterioportal shunt | Mestre |
| HM-071 | Carcinogenese/lesoes focais | Infectologia | Lesao + febre | Chamar de tumor sem pensar abscesso | Abscesso, metastase, HCC necrotico | Avancado |
| HM-072 | Carcinogenese/lesoes focais | Transplante/oncologia | HCC + funcao hepatica ruim | Separar tumor de reserva hepatica | HCC, BCLC, Child/MELD, transplante | Mestre |
| HM-073 | Toxicologia/farmacologia | Esporte/endocrino | Colestase + academia | Nao perguntar anabolizante | DILI androgenico, obstrucao, PBC | Avancado |
| HM-074 | Toxicologia/farmacologia | Psiquiatria | Hepatograma + polifarmacia | Culpar um unico remedio sem temporalidade | DILI, MASLD, alcool, viral | Avancado |
| HM-075 | Toxicologia/farmacologia | Fitoterapia | Ictericia + suplemento natural | Assumir que natural e seguro | DILI, viral, autoimune | Intermediario |
| HM-076 | Toxicologia/farmacologia | Infectologia | TB/HIV + hepatograma | Nao integrar infeccao e hepatotoxicidade | DILI, HBV/HCV, oportunistas | Mestre |
| HM-077 | Toxicologia/farmacologia | Oncologia | Imunoterapia + hepatite | Tratar como viral automaticamente | Hepatite imune, DILI, progressao tumoral | Mestre |
| HM-078 | Toxicologia/farmacologia | Dor/ortopedia | Analgesico + ALF | Subestimar paracetamol combinado | Paracetamol, DILI, viral | Mestre |
| HM-079 | Obstetricia/figado | Ginecologia | Prurido gestacional | Nao diferenciar gravidade materna/fetal | Colestase gestacional, HELLP, AFLP | Avancado |
| HM-080 | Obstetricia/figado | Emergencia | Dor epigastrica + plaqueta baixa | Atribuir a gastrite gestacional | HELLP, AFLP, pre-eclampsia | Mestre |
| HM-081 | Obstetricia/figado | Hematologia | Ictericia pos-parto | Nao pensar trombose/hemolise | HELLP, Budd-Chiari, hemolise | Mestre |
| HM-082 | Obstetricia/figado | Infectologia | Hepatite na gestacao | Ignorar hepatite E/gravidade | HEV, HAV, HBV, DILI | Mestre |
| HM-083 | Obstetricia/figado | Farmacologia | Hormonal pos-parto + dor | Nao perguntar medicacao hormonal | Budd-Chiari, adenoma, DILI | Avancado |
| HM-084 | Obstetricia/figado | Metabolico | Gestante com esteatose previa | Nao integrar MASLD e risco obstetrico | MASLD, pre-eclampsia, colestase | Avancado |
| HM-085 | Pre-operatorio | Cirurgia | Cirrose em avaliacao cirurgica | Usar so Child sem contexto | Risco cirurgico, portal HTN, coagulacao | Avancado |
| HM-086 | Pre-operatorio | Anestesia | INR/plaqueta alterados | Corrigir laboratorio sem estrategia | Coagulacao na cirrose, trombose, sangramento | Mestre |
| HM-087 | Pre-operatorio | Oncologia | Resseccao hepatica possivel | Ignorar reserva hepatica/futuro remanescente | HCC, metastase, cirrose | Mestre |
| HM-088 | Pre-operatorio | Cardiologia | IC + cirurgia + hepatograma | Ignorar congestao hepatica | Hepatopatia congestiva, risco anestesico | Avancado |
| HM-089 | Pre-operatorio | Nefrologia | Contraste em cirrotico | Subestimar risco renal | IRA, HRS, contraste, ascite | Avancado |
| HM-090 | Pre-operatorio | Nutricao/geriatria | Fragilidade antes de TIPS/cirurgia | Focar so no procedimento | Sarcopenia, ascite, HE, risco funcional | Mestre |
| HM-091 | Hematologia/coagulacao | Hematologia | Plaqueta baixa + baco | Diagnosticar PTI sem portal HTN | Hiperesplenismo, cirrose, MPN | Intermediario |
| HM-092 | Hematologia/coagulacao | Vascular | Anticoagulacao em cirrotico | Achar que INR protege contra trombose | Trombose portal, varizes, coagulacao rebalanceada | Mestre |
| HM-093 | Hematologia/coagulacao | Emergencia | Sangramento + plaqueta baixa | Focar so em transfusao | Varizes, DIC, falencia hepatica | Mestre |
| HM-094 | Hematologia/coagulacao | Oncologia | Trombose + lesao hepatica | Nao diferenciar trombo tumoral | HCC, trombose portal, neoplasia | Mestre |
| HM-095 | Hematologia/coagulacao | Metabolico | Ferritina + citopenias | Ignorar inflamacao/alcool/metabolico | Hemocromatose, alcool, MASLD | Avancado |
| HM-096 | Hematologia/coagulacao | Infectologia | Hepatite + purpura | Nao pensar crioglobulinemia | HCV, vasculite, coagulopatia | Mestre |

## Proxima implementacao

Para integrar ao app atual:

1. Converter esta matriz para `case-archetypes.json`.
2. Fazer o gerador escolher primeiro o arquetipo, nao o caso escrito.
3. Usar quotas por mecanismo, interface e porta de entrada.
4. Gerar o enredo a partir do arquetipo com campos obrigatorios de anamnese.
5. Guardar no historico: `mechanism`, `interface`, `presentation`, `pitfall`, `caseKey`.
6. Expor ao aluno apenas a narrativa; manter o arquetipo invisivel.
