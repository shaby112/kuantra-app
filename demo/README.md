# NovaMart Demo Environment

Realistic multi-source e-commerce dataset proving Kuantra's core USP:
**sub-100ms JOINs across disconnected data sources**.

## Data Sources

| Source   | Container           | Port  | Contents                                |
|----------|---------------------|-------|-----------------------------------------|
| Postgres | `novamart-postgres` | 5433  | `novamart.customers`, `orders`, `order_items` |
| MongoDB  | `novamart-mongo`    | 27018 | `novamart.support_tickets`              |
| CSV      | local files         | —     | `product_catalog.csv`, `inventory.csv`  |
| Excel    | local files         | —     | `marketing_spend.xlsx`                  |

## Shared Keys

All sources share these foreign keys for MDL auto-discovery:

- `customer_id` — `CUST-000001` through `CUST-000200`
- `product_id` — `PROD-000001` through `PROD-000080`
- `order_id` — `ORD-000001` through `ORD-001500`

## Quick Start

```bash
# 1. Install Python deps
pip install -r requirements.txt

# 2. Generate all data files
python seed_demo.py --files-only

# 3. Start Postgres + MongoDB with pre-loaded data
docker compose -f docker-compose.demo.yml up -d

# 4. Connect Kuantra to each source via the UI
#    Postgres -> localhost:5433, user: novamart, pass: novamart, db: novamart
#    MongoDB  -> localhost:27018, db: novamart
#    CSV/Excel -> upload via file connector
```

## Custom Data Sizes

```bash
python seed_demo.py --files-only \
    --customers 500 \
    --products 200 \
    --orders 5000 \
    --tickets 1000 \
    --marketing-days 365
```

## Teardown

```bash
docker compose -f docker-compose.demo.yml down -v
```
