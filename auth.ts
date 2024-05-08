import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { Pool } from 'pg';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';

// Configurações de conexão com o banco de dados local
const pool = new Pool({
    user: process.env.POSTGRES_USER, // Seu nome de usuário do PostgreSQL
    host: process.env.POSTGRES_HOST, // Endereço do host onde o PostgreSQL está sendo executado (normalmente 'localhost')
    database: process.env.POSTGRES_DATABASE, // Nome do banco de dados que você quer se conectar
    password: process.env.POSTGRES_PASSWORD, // Sua senha do PostgreSQL
    port: 5432, // Porta padrão do PostgreSQL é 5432
});

async function getUser(email: string): Promise<User | undefined> {
    try {
        const client = await pool.connect();
        const query = `SELECT * FROM users WHERE email='${email}'`;
        const result = await client.query(query);
        return result.rows[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) return user;
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});