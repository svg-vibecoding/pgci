DELETE FROM auth.refresh_tokens r
 WHERE r.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = r.user_id);

DELETE FROM auth.sessions s
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

DELETE FROM auth.identities i
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.user_id);