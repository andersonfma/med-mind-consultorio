-- Adiciona a especialidade "Hepatologia" ao CHECK constraint da coluna specialty.
-- Sem isso, o INSERT de paciente com specialty='Hepatologia' é rejeitado pelo banco.
-- Mantém em sincronia com SPECIALTIES em src/lib/patients/specialties.ts.

ALTER TABLE patients
  DROP CONSTRAINT patients_specialty_check;

ALTER TABLE patients
  ADD CONSTRAINT patients_specialty_check CHECK (specialty IN (
    'Clínica Médica', 'Cardiologia', 'Gastroenterologia',
    'Pneumologia', 'Endocrinologia', 'Nefrologia',
    'Neurologia', 'Infectologia', 'Hepatologia'
  ));
