-- Migration: garante que o campo role existe em public.profiles
-- Execute este script no Supabase SQL Editor caso a tabela já tenha sido
-- criada sem o campo role (via setup.sql anterior).

-- Adiciona o campo role se ainda não existir
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player';

-- Aplica a constraint de valores permitidos (ignorada se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('player', 'admin'));
  END IF;
END;
$$;

-- Garante que usuários existentes sem role recebam 'player'
UPDATE public.profiles SET role = 'player' WHERE role IS NULL;

-- Para dar role admin a um usuário específico, execute:
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid-do-usuario>';
