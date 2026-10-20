JBenz Bistro

<img width="1348" height="596" alt="image" src="https://github.com/user-attachments/assets/9669b609-4034-4c3d-9b97-c8eb357d0590" />

## PayMongo refund workflow setup

1. Apply `lib/supabase/refunds_schema.sql` if the existing refund audit table is not installed, then run `lib/supabase/refund_workflow_migration.sql` in the Supabase SQL editor.
2. Configure the server-only `SUPABASE_SERVICE_ROLE_KEY`, `PAYMONGO_SECRET_KEY`, and `PAYMONGO_WEBHOOK_SECRET_KEY` environment variables. Never prefix these values with `NEXT_PUBLIC_`.
3. Configure the PayMongo webhook endpoint as `/api/webhooks/paymongo` and subscribe to checkout payment success and refund created/updated events. Refund webhooks are rejected until a valid webhook secret is configured.
4. Customers can request a refund from their own paid reservation in Profile. Admins and managers review requests at `/admin/refunds` or `/manager/refunds`; approved requests require a separate confirmed processing action.

Refund provider timeouts and unrecognized responses are kept ambiguous and cannot be retried through the application. Reconcile a known PayMongo refund ID through the admin screen; if no provider ID was received, verify the transaction in PayMongo before taking further action.
