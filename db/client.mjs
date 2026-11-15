import { drizzle } from 'drizzle-orm/netlify-db';
import { sql } from 'drizzle-orm';
// Initialize lazily so importing a function never opens a database connection.
let database;
export function getStore() {
  database ??= drizzle();
  return {
    async sql(strings, ...values) {
      const result = await database.execute(sql(strings, ...values));
      return result.rows;
    },
  };
}
