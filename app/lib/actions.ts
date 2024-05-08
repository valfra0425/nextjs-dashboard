'use server';

import { Pool } from 'pg';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// Configurações de conexão com o banco de dados local
const pool = new Pool({
  user: process.env.POSTGRES_USER, // Seu nome de usuário do PostgreSQL
  host: process.env.POSTGRES_HOST, // Endereço do host onde o PostgreSQL está sendo executado (normalmente 'localhost')
  database: process.env.POSTGRES_DATABASE, // Nome do banco de dados que você quer se conectar
  password: process.env.POSTGRES_PASSWORD, // Sua senha do PostgreSQL
  port: 5432, // Porta padrão do PostgreSQL é 5432
});

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    const client = await pool.connect();

    const query = {
      text: 'INSERT INTO invoices (customer_id, amount, status, date) VALUES ($1, $2, $3, $4)',
      values: [customerId, amountInCents, status, date],
    };

    await client.query(query);

    client.release();
  } catch (error) {
    return { message: 'Database Error: Failed to Create a Invoice.' }
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    const client = await pool.connect();

    const query = {
      text: 'UPDATE invoices SET customer_id = $1, amount = $2, status = $3 where id = $4',
      values: [customerId, amountInCents, status, id],
    };

    await client.query(query);

    client.release();

  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' }
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    const client = await pool.connect();

    const query = `DELETE from invoices where id = '${id}'`;

    await client.query(query);

    client.release();

  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' }
  }
  revalidatePath('/dashboard/invoices')
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }

}
