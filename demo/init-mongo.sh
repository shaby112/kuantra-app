#!/bin/bash
# Seed MongoDB with NovaMart support tickets on first container start.
set -e

echo "Importing NovaMart support tickets into MongoDB..."
mongoimport \
    --db novamart \
    --collection support_tickets \
    --type json \
    --jsonArray \
    --file /docker-entrypoint-initdb.d/support_tickets.json

echo "Creating indexes..."
mongosh novamart --eval '
    db.support_tickets.createIndex({ customer_id: 1 });
    db.support_tickets.createIndex({ order_id: 1 });
    db.support_tickets.createIndex({ status: 1 });
    db.support_tickets.createIndex({ created_at: 1 });
    print("NovaMart MongoDB seed complete — " + db.support_tickets.countDocuments({}) + " tickets loaded");
'
