import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = postgres(connectionString, { prepare: false })

const orgId = process.argv[2]
if (!orgId) {
  console.error('Usage: node provision-tenant.mjs <org-id>')
  process.exit(1)
}

await sql`INSERT INTO tenants (id) VALUES (${orgId}) ON CONFLICT (id) DO NOTHING`
console.log(`Provisioned tenant ${orgId}`)
await sql.end()
