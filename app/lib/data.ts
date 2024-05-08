import { Pool } from 'pg';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Invoice,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';

// Configurações de conexão com o banco de dados local
const pool = new Pool({
  user: process.env.POSTGRES_USER, // Seu nome de usuário do PostgreSQL
  host: process.env.POSTGRES_HOST, // Endereço do host onde o PostgreSQL está sendo executado (normalmente 'localhost')
  database: process.env.POSTGRES_DATABASE, // Nome do banco de dados que você quer se conectar
  password: process.env.POSTGRES_PASSWORD, // Sua senha do PostgreSQL
  port: 5432, // Porta padrão do PostgreSQL é 5432
});

export async function fetchRevenue() {
  try {
    noStore();
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const query = 'SELECT * FROM revenue'; // Consulta SQL para buscar os dados de receita

    const result = await client.query(query); // Executa a consulta no banco de dados

    client.release(); // Libera o cliente de volta para o pool após a consulta
    console.log('Data fetch completed after 3 seconds.');
    return result.rows; // Retorna as linhas resultantes da consulta
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    noStore();
    console.log('Fetching lastest invoices data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const query = `
      SELECT invoices.amount, customers.name, customers.image_url, customers.email
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

      const result = await client.query(query); // Executa a consulta no banco de dados

      client.release(); // Libera o cliente de volta para o pool após a consulta
  
      const latestInvoices = result.rows.map((invoice) => ({
        ...invoice,
        amount: formatCurrency(invoice.amount),
      }));
      console.log('Data fetch completed after 3 seconds.');
      return latestInvoices;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch lastest invoices data.');
    }
}

export async function fetchCardData() {
  try {
    noStore();
    console.log('Fetching cards data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = `SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = `SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = `SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      client.query(invoiceCountPromise),
      client.query(customerCountPromise),
      client.query(invoiceStatusPromise),
    ]);

    client.release(); // Libera o cliente de volta para o pool após a consulta

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    console.log('Data fetch completed after 3 seconds.');
    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  noStore();
  try {

    const client = await pool.connect();

    const queryM = `
    SELECT
      invoices.id,
      invoices.amount,
      invoices.date,
      invoices.status,
      customers.name,
      customers.email,
      customers.image_url
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE '%${query}%' OR
      customers.email ILIKE '%${query}%' OR
      invoices.amount::text ILIKE '%${query}%' OR
      invoices.date::text ILIKE '%${query}%' OR
      invoices.status ILIKE '%${query}%'
    ORDER BY invoices.date DESC
    LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    const result = await pool.query(queryM);

    client.release();

    return result.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    noStore();
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const queryM = `SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE '%${query}%' OR
      customers.email ILIKE '%${query}%' OR
      invoices.amount::text ILIKE '%${query}%' OR
      invoices.date::text ILIKE '%${query}%' OR
      invoices.status ILIKE '%${query}%'
    `;

    const result = await client.query(queryM);

    client.release();

    const totalPages = Math.ceil(Number(result.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    noStore();
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const query = `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = '${id}';
    `;

    const result = await client.query(query);

    client.release();

    const invoice: Invoice[] = result.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    noStore();
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const query = `
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    const result = await client.query(query);

    client.release();

    const customers = result.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

// não testado
export async function fetchFilteredCustomers(query: string) {
  try {
    noStore();
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const queryM = `
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const result = await client.query(queryM);

    client.release();

    const customers = result.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

// não testado
export async function getUser(email: string) {
  try {
    noStore();
    const client = await pool.connect(); // Conecta-se ao banco de dados usando o pool

    const query = `SELECT * FROM users WHERE email=${email}`;

    const result = await client.query(query);

    client.release();

    return result.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}