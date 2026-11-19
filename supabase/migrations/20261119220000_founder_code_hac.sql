-- Código de fundador para o Hospital Alcides Carneiro (ação presencial / turma de teste).
-- Diferente da Hepatoliga (BJ2K29) e do HAS (HAS2026, 1 ano): concede apenas 30 dias de
-- Premium, por ser fase de teste e pelo custo de IA dos simulados. Até 200 alunos.
-- Aplicado em produção via REST (service role) em 2026-11-19; migration para o registro.
INSERT INTO founder_codes (code, label, grant_days, max_uses)
VALUES ('HAC2026', 'Hospital Alcides Carneiro', 30, 200)
ON CONFLICT (code) DO NOTHING;
