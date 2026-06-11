import postgres from 'postgres'

const sql = postgres(
  'postgresql://postgres:S9JLpGt71IXzuG4l@db.zhcflyuhrtnbbgmshsni.supabase.co:5432/postgres',
  { prepare: false },
)

const orgId = process.argv[2]
if (!orgId) {
  console.error('Usage: node provision-tenant.mjs <org-id>')
  process.exit(1)
}

await sql`INSERT INTO tenants (id) VALUES (${orgId}) ON CONFLICT (id) DO NOTHING`
console.log(`Provisioned tenant ${orgId}`)
await sql.end()
