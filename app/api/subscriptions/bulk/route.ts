// app/api/subscriptions/bulk/route.ts

import { NextResponse } from 'next/server';  // To handle HTTP responses
import { deleteBulkSubscriptions } from './your-sql-function';  // Import your delete function

export async function DELETE(request: Request) {
  try {
    // Extract the list of IDs from the request body
    const { idList } = await request.json();  // Assuming a JSON body with idList

    // Call the delete function
    const result = await deleteBulkSubscriptions(idList);

    if (result.success) {
      return NextResponse.json({ message: 'Successfully deleted subscriptions' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to delete subscriptions' }, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
