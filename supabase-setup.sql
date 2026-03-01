-- ============================================================
-- FUTSABÃO — Supabase Setup
-- Execute isso no SQL Editor do Supabase (supabase.com > seu projeto > SQL Editor)
-- ============================================================

-- Tabela única que guarda todo o estado do campeonato como JSON
-- Simples, eficiente, e permite real-time pra todo mundo
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insere o estado inicial vazio
INSERT INTO app_state (id, state) VALUES ('main', '{}')
ON CONFLICT (id) DO NOTHING;

-- Habilita Realtime nessa tabela (só adiciona se ainda não estiver na publicação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_state;
  END IF;
END $$;

-- Permite leitura e escrita pra qualquer um (sem auth, público pro evento)
-- Em produção você pode restringir com RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ler" ON app_state;
DROP POLICY IF EXISTS "Todos podem atualizar" ON app_state;
DROP POLICY IF EXISTS "Todos podem inserir" ON app_state;
CREATE POLICY "Todos podem ler" ON app_state FOR SELECT USING (true);
CREATE POLICY "Todos podem atualizar" ON app_state FOR UPDATE USING (true);
CREATE POLICY "Todos podem inserir" ON app_state FOR INSERT WITH CHECK (true);

-- ============================================================
-- PRONTO! Agora copie a URL e a anon key do seu projeto Supabase
-- e cole no .env.local do projeto
-- ============================================================
