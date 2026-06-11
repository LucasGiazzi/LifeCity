-- Pré-requisito: users com estes e-mails já existem (cadastro app ou INSERT prévio)
INSERT INTO public.platform_users (user_id, role)
SELECT u.id, 'admin'::public.platform_role
FROM public.users u
WHERE u.email IN ('lucasgiazzi@gmail.com', 'bernardo.wiemer333@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = true;
