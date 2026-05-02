-- Pedidos de amizade entre utilizadores (complementar a public.users)
-- Executar na base Supabase/Postgres após a tabela users existir.

CREATE TABLE IF NOT EXISTS public.friendships (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_requester_fkey FOREIGN KEY (requester_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT friendships_addressee_fkey FOREIGN KEY (addressee_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_pending
  ON public.friendships (addressee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friendships_requester_pending
  ON public.friendships (requester_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friendships_users_accepted
  ON public.friendships (requester_id, addressee_id)
  WHERE status = 'accepted';
