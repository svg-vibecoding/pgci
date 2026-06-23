-- Agrega la columna parent_client_id a clients si aún no existe
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS parent_client_id uuid;

-- Agrega la FK hacia clients(id) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND constraint_name = 'clients_parent_client_id_fkey'
  ) THEN
    ALTER TABLE public.clients
    ADD CONSTRAINT clients_parent_client_id_fkey
    FOREIGN KEY (parent_client_id) REFERENCES public.clients(id);
  END IF;
END $$;