const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE
  }
});
const {
  invoices,
  customers,
  revenue,
  users,
} = require('../app/lib/placeholder-data.js');
const bcrypt = require('bcrypt');

async function seedUsers(knex) {
  try {
    // Criar a extensão 'uuid-ossp' se ainda não existir
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // Criar a tabela 'users' se ainda não existir
    await knex.schema.createTableIfNotExists('users', function(table) {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.string('name', 255).notNullable();
      table.text('email').notNullable().unique;
      table.text('password').notNullable();
    });

    console.log(`Created "users" table`);

    // Inserir dados na tabela 'users'
    const insertedUsers = await Promise.all(
      users.map(async (users) => {
        const hashedPassword = await bcrypt.hash(users.password, 10);
        return knex('users').insert({
          id: users.id,
          name: users.name,
          email: users.email,
          password: hashedPassword
        }).onConflict('id').ignore();
      })
    );

    console.log(`Seeded ${insertedUsers.length} users`);

    return {
      users: insertedUsers
    };
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
}

async function seedInvoices(knex) {
  try {
    // Criar a extensão 'uuid-ossp' se ainda não existir
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create the "invoices" table if it doesn't exist
    await knex.schema.createTableIfNotExists('invoices', function(table) {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.uuid('customer_id').notNullable().references('id').inTable('customers');
      table.integer('amount').notNullable();
      table.string('status', 255).notNullable();
      table.date('date').notNullable();
    });

    console.log(`Created "invoices" table`);

    // Inserir dados na tabela 'invoices'
    const insertedInvoices = await Promise.all(
      invoices.map(async (invoice) => {
        return knex('invoices').insert({
          customer_id: invoice.customer_id,
          amount: invoice.amount,
          status: invoice.status,
          date: invoice.date
        }).onConflict('id').ignore();
      })
    );

    console.log(`Seeded ${insertedInvoices.length} invoices`);

    return {
      invoices: insertedInvoices
    };
  } catch (error) {
    console.error('Error seeding invoices:', error);
    throw error;
  }
}

async function seedCustomers(knex) {
  try {
    // Criar a extensão 'uuid-ossp' se ainda não existir
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create the "customers" table if it doesn't exist
    await knex.schema.createTableIfNotExists('customers', function(table) {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.string('name', 255).notNullable();
      table.string('email', 255).notNullable();
      table.string('image_url', 255).notNullable();
    });

    console.log(`Created "customers" table`);

    // Inserir dados na tabela 'customers'
    const insertedCustomers = await Promise.all(
      customers.map(async (customer) => {
        return knex('customers').insert({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          image_url: customer.image_url
        }).onConflict('id').ignore();
      })
    );

    console.log(`Seeded ${insertedCustomers.length} customers`);

    return {
      customers: insertedCustomers
    };
  } catch (error) {
    console.error('Error seeding customers:', error);
    throw error;
  }
}

async function seedRevenue(knex) {
  try {
    // Create the "revenue" table if it doesn't exist
    await knex.schema.createTableIfNotExists('revenue', function(table) {
      table.string('month', 4).notNullable().unique();
      table.integer('revenue').notNullable();
    });

    console.log(`Created "revenue" table`);

    // Inserir dados na tabela 'revenue'
    const insertedRevenue = await Promise.all(
      revenue.map(async (revenue) => {
        return knex('revenue').insert({
          month: revenue.month,
          revenue: revenue.revenue
        }).onConflict('month').ignore();
      })
    );

    console.log(`Seeded ${insertedRevenue.length} revenue`);

    return {
      revenue: insertedRevenue
    };
  } catch (error) {
    console.error('Error seeding revenue:', error);
    throw error;
  }
}

async function main() {
  try {
    // Seed de usuários
    await seedUsers(knex);

    // Seed de clientes
    await seedCustomers(knex);

    // Seed de faturas
    await seedInvoices(knex);

    // Seed de receita
    await seedRevenue(knex);
  } catch (error) {
    console.error('Erro durante a seed:', error);
  } finally {
    // Fechar a conexão com o banco de dados
    await knex.destroy();
  }
}

main().catch((err) => {
  console.error(
    'An error occurred while attempting to seed the database:',
    err,
  );
});
