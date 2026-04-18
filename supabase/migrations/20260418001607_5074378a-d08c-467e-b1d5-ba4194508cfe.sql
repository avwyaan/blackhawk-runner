UPDATE auth.users
SET encrypted_password = crypt('admin123789', gen_salt('bf')),
    updated_at = now()
WHERE email = 'wygnesh@gmail.com';