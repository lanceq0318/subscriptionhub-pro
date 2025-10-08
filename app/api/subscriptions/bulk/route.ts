import { sql } from 'your-db-package'; // Your SQL package (e.g., pg, knex)

export async function deleteBulkSubscriptions(idList: number[]) {
  try {
    // Convert idList to string if necessary
    const idListStr = idList.join(',');

    // Correct use of sql.array() for PostgreSQL
    const idArr = await sql.array(idList, 'int4'); // Casting to an integer array (int4)

    // Delete queries using the properly cast array
    await sql`DELETE FROM payments WHERE subscription_id = ANY(${idArr})`;
    await sql`DELETE FROM attachments WHERE subscription_id = ANY(${idArr})`;
    await sql`DELETE FROM subscription_tags WHERE subscription_id = ANY(${idArr})`;
    await sql`DELETE FROM subscriptions WHERE id = ANY(${idArr})`;

    return { success: true };
  } catch (error) {
    console.error('Error during bulk delete:', error);
    throw error;
  }
}
