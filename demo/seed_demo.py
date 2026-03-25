#!/usr/bin/env python3
"""
NovaMart Demo Data Generator
=============================
Generates a realistic e-commerce dataset split across four data sources:

  1. Postgres  -> customers, orders, order_items
  2. MongoDB   -> support_tickets
  3. CSV       -> product_catalog.csv, inventory.csv
  4. Excel     -> marketing_spend.xlsx

All sources share foreign keys (customer_id, product_id, order_id) so
Kuantra's MDL auto-discovery engine can detect cross-source relationships.

Usage:
    python seed_demo.py                    # generate files + seed Postgres & Mongo
    python seed_demo.py --files-only       # only write CSV/Excel (no DB connections)
    python seed_demo.py --customers 500    # override default counts
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

try:
    import openpyxl
except ImportError:
    openpyxl = None

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SEED = 42
OUTPUT_DIR = Path(__file__).resolve().parent / "data"

DEFAULT_COUNTS = {
    "customers": 200,
    "products": 80,
    "orders": 1500,
    "tickets": 400,
    "marketing_days": 180,
}

PRODUCT_CATEGORIES = [
    "Electronics", "Clothing", "Home & Kitchen", "Sports & Outdoors",
    "Books", "Toys & Games", "Health & Beauty", "Grocery",
    "Office Supplies", "Pet Supplies",
]

MARKETING_CHANNELS = [
    "Google Ads", "Facebook Ads", "Instagram Ads", "TikTok Ads",
    "Email Campaign", "Influencer", "Affiliate", "LinkedIn Ads",
]

TICKET_CATEGORIES = [
    "Shipping Delay", "Wrong Item", "Refund Request", "Product Defect",
    "Account Issue", "Payment Problem", "Return Label", "Size Exchange",
    "Missing Item", "Billing Question",
]

TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"]
TICKET_PRIORITIES = ["low", "medium", "high", "urgent"]

ORDER_STATUSES = [
    "pending", "confirmed", "shipped", "delivered", "cancelled", "returned",
]

# ---------------------------------------------------------------------------
# Deterministic IDs (shared across all sources)
# ---------------------------------------------------------------------------

fake = Faker()
Faker.seed(SEED)
random.seed(SEED)


def _uuid(prefix: str, n: int) -> str:
    """Generate a deterministic, human-readable ID."""
    return f"{prefix}-{n:06d}"


# ---------------------------------------------------------------------------
# Data generators
# ---------------------------------------------------------------------------

def gen_customers(n: int) -> list[dict]:
    customers = []
    for i in range(1, n + 1):
        created = fake.date_time_between(start_date="-2y", end_date="-30d")
        customers.append({
            "customer_id": _uuid("CUST", i),
            "first_name": fake.first_name(),
            "last_name": fake.last_name(),
            "email": fake.unique.email(),
            "phone": fake.phone_number(),
            "city": fake.city(),
            "state": fake.state_abbr(),
            "country": "US",
            "signup_date": created.strftime("%Y-%m-%d"),
            "lifetime_value": round(random.uniform(50, 12000), 2),
        })
    return customers


def gen_products(n: int) -> list[dict]:
    products = []
    for i in range(1, n + 1):
        category = random.choice(PRODUCT_CATEGORIES)
        price = round(random.uniform(4.99, 499.99), 2)
        products.append({
            "product_id": _uuid("PROD", i),
            "product_name": fake.catch_phrase(),
            "category": category,
            "subcategory": fake.bs().title(),
            "price": price,
            "cost": round(price * random.uniform(0.3, 0.7), 2),
            "supplier": fake.company(),
            "sku": fake.bothify("???-#####").upper(),
            "weight_kg": round(random.uniform(0.1, 25.0), 2),
            "rating": round(random.uniform(1.0, 5.0), 1),
        })
    return products


def gen_inventory(products: list[dict]) -> list[dict]:
    warehouses = ["WH-EAST", "WH-WEST", "WH-CENTRAL"]
    rows = []
    for p in products:
        for wh in warehouses:
            rows.append({
                "product_id": p["product_id"],
                "warehouse": wh,
                "quantity_on_hand": random.randint(0, 500),
                "reorder_point": random.randint(10, 50),
                "last_restocked": fake.date_between(
                    start_date="-60d", end_date="today"
                ).isoformat(),
            })
    return rows


def gen_orders(n: int, customers: list[dict], products: list[dict]):
    """Return (orders, order_items) tuple."""
    orders = []
    items = []
    item_seq = 0

    for i in range(1, n + 1):
        cust = random.choice(customers)
        order_date = fake.date_time_between(start_date="-1y", end_date="now")
        status = random.choice(ORDER_STATUSES)

        ship_date = None
        if status in ("shipped", "delivered", "returned"):
            ship_date = order_date + timedelta(days=random.randint(1, 5))

        num_items = random.randint(1, 5)
        chosen_products = random.sample(
            products, min(num_items, len(products))
        )

        order_total = 0
        for prod in chosen_products:
            item_seq += 1
            qty = random.randint(1, 4)
            line_total = round(prod["price"] * qty, 2)
            order_total += line_total
            items.append({
                "item_id": item_seq,
                "order_id": _uuid("ORD", i),
                "product_id": prod["product_id"],
                "quantity": qty,
                "unit_price": prod["price"],
                "line_total": line_total,
            })

        orders.append({
            "order_id": _uuid("ORD", i),
            "customer_id": cust["customer_id"],
            "order_date": order_date.strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
            "total_amount": round(order_total, 2),
            "shipping_date": ship_date.strftime("%Y-%m-%d") if ship_date else None,
            "payment_method": random.choice(
                ["credit_card", "debit_card", "paypal", "apple_pay", "bank_transfer"]
            ),
        })

    return orders, items


def gen_tickets(
    n: int, customers: list[dict], orders: list[dict]
) -> list[dict]:
    tickets = []
    for i in range(1, n + 1):
        cust = random.choice(customers)
        order = random.choice(orders)
        created = fake.date_time_between(start_date="-6m", end_date="now")
        resolved = None
        status = random.choice(TICKET_STATUSES)
        if status in ("resolved", "closed"):
            resolved = created + timedelta(
                hours=random.randint(1, 72)
            )

        tickets.append({
            "ticket_id": _uuid("TKT", i),
            "customer_id": cust["customer_id"],
            "order_id": order["order_id"],
            "category": random.choice(TICKET_CATEGORIES),
            "priority": random.choice(TICKET_PRIORITIES),
            "status": status,
            "subject": fake.sentence(nb_words=6),
            "description": fake.paragraph(nb_sentences=3),
            "created_at": created.isoformat(),
            "resolved_at": resolved.isoformat() if resolved else None,
            "agent_name": fake.name(),
            "satisfaction_score": (
                random.randint(1, 5) if status in ("resolved", "closed") else None
            ),
        })
    return tickets


def gen_marketing(days: int, products: list[dict]) -> list[dict]:
    rows = []
    start = datetime.now() - timedelta(days=days)
    for d in range(days):
        date = (start + timedelta(days=d)).strftime("%Y-%m-%d")
        for channel in random.sample(MARKETING_CHANNELS, random.randint(3, 6)):
            prod = random.choice(products)
            spend = round(random.uniform(50, 3000), 2)
            impressions = random.randint(1000, 500000)
            clicks = int(impressions * random.uniform(0.005, 0.08))
            conversions = int(clicks * random.uniform(0.01, 0.15))
            rows.append({
                "date": date,
                "channel": channel,
                "product_id": prod["product_id"],
                "spend_usd": spend,
                "impressions": impressions,
                "clicks": clicks,
                "conversions": conversions,
                "cpc": round(spend / max(clicks, 1), 2),
                "cpa": round(spend / max(conversions, 1), 2),
            })
    return rows


# ---------------------------------------------------------------------------
# File writers
# ---------------------------------------------------------------------------

def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"  [CSV]   {path.name}  ({len(rows):,} rows)")


def write_excel(path: Path, sheets: dict[str, list[dict]]) -> None:
    if openpyxl is None:
        print("  [WARN]  openpyxl not installed — skipping Excel output")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    first = True
    for sheet_name, rows in sheets.items():
        ws = wb.active if first else wb.create_sheet()
        first = False
        ws.title = sheet_name
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row[h] for h in headers])
        print(f"  [XLSX]  {path.name} / {sheet_name}  ({len(rows):,} rows)")
    wb.save(path)


def write_json(path: Path, rows: list[dict]) -> None:
    """Write JSON for MongoDB init script consumption."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(rows, f, indent=2, default=str)
    print(f"  [JSON]  {path.name}  ({len(rows):,} docs)")


def write_sql_inserts(path: Path, customers: list[dict], orders: list[dict],
                      order_items: list[dict]) -> None:
    """Write SQL INSERT statements for Postgres init."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = []

    # Schema
    lines.append("""\
-- NovaMart Demo Schema
-- Auto-generated by seed_demo.py

CREATE SCHEMA IF NOT EXISTS novamart;

CREATE TABLE IF NOT EXISTS novamart.customers (
    customer_id   VARCHAR(20) PRIMARY KEY,
    first_name    VARCHAR(100),
    last_name     VARCHAR(100),
    email         VARCHAR(200) UNIQUE,
    phone         VARCHAR(50),
    city          VARCHAR(100),
    state         VARCHAR(10),
    country       VARCHAR(10) DEFAULT 'US',
    signup_date   DATE,
    lifetime_value NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS novamart.orders (
    order_id       VARCHAR(20) PRIMARY KEY,
    customer_id    VARCHAR(20) REFERENCES novamart.customers(customer_id),
    order_date     TIMESTAMP,
    status         VARCHAR(20),
    total_amount   NUMERIC(12,2),
    shipping_date  DATE,
    payment_method VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS novamart.order_items (
    item_id      SERIAL PRIMARY KEY,
    order_id     VARCHAR(20) REFERENCES novamart.orders(order_id),
    product_id   VARCHAR(20),
    quantity     INTEGER,
    unit_price   NUMERIC(10,2),
    line_total   NUMERIC(12,2)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON novamart.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON novamart.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_product ON novamart.order_items(product_id);
""")

    # Customers
    for c in customers:
        vals = (
            _esc(c["customer_id"]), _esc(c["first_name"]), _esc(c["last_name"]),
            _esc(c["email"]), _esc(c["phone"]), _esc(c["city"]),
            _esc(c["state"]), _esc(c["country"]), _esc(c["signup_date"]),
            c["lifetime_value"],
        )
        lines.append(
            f"INSERT INTO novamart.customers VALUES ("
            f"'{vals[0]}','{vals[1]}','{vals[2]}','{vals[3]}','{vals[4]}',"
            f"'{vals[5]}','{vals[6]}','{vals[7]}','{vals[8]}',{vals[9]});"
        )

    # Orders
    for o in orders:
        ship = f"'{_esc(o['shipping_date'])}'" if o["shipping_date"] else "NULL"
        lines.append(
            f"INSERT INTO novamart.orders VALUES ("
            f"'{_esc(o['order_id'])}','{_esc(o['customer_id'])}',"
            f"'{_esc(o['order_date'])}','{_esc(o['status'])}',"
            f"{o['total_amount']},{ship},'{_esc(o['payment_method'])}');"
        )

    # Order items
    for it in order_items:
        lines.append(
            f"INSERT INTO novamart.order_items (order_id, product_id, quantity, "
            f"unit_price, line_total) VALUES ("
            f"'{_esc(it['order_id'])}','{_esc(it['product_id'])}',"
            f"{it['quantity']},{it['unit_price']},{it['line_total']});"
        )

    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  [SQL]   {path.name}  "
          f"({len(customers)} customers, {len(orders)} orders, "
          f"{len(order_items)} items)")


def _esc(val: str) -> str:
    """Escape single quotes for SQL literals."""
    if val is None:
        return ""
    return str(val).replace("'", "''")


# ---------------------------------------------------------------------------
# Database seeders (optional — only when --files-only is NOT set)
# ---------------------------------------------------------------------------

def seed_postgres(sql_path: Path) -> None:
    """Execute the generated SQL file against the demo Postgres instance."""
    try:
        import psycopg2
    except ImportError:
        print("  [SKIP]  psycopg2 not installed — use the SQL file directly")
        return

    host = os.getenv("DEMO_PG_HOST", "localhost")
    port = int(os.getenv("DEMO_PG_PORT", "5433"))
    user = os.getenv("DEMO_PG_USER", "novamart")
    password = os.getenv("DEMO_PG_PASSWORD", "novamart")
    dbname = os.getenv("DEMO_PG_DB", "novamart")

    try:
        conn = psycopg2.connect(
            host=host, port=port, user=user, password=password, dbname=dbname
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql_path.read_text())
        conn.close()
        print(f"  [PG]    Seeded Postgres @ {host}:{port}/{dbname}")
    except Exception as e:
        print(f"  [PG]    Could not connect to Postgres: {e}")
        print(f"          SQL file is ready at {sql_path}")


def seed_mongo(tickets: list[dict]) -> None:
    """Insert support tickets into the demo MongoDB instance."""
    try:
        from pymongo import MongoClient
    except ImportError:
        print("  [SKIP]  pymongo not installed — use the JSON file directly")
        return

    host = os.getenv("DEMO_MONGO_HOST", "localhost")
    port = int(os.getenv("DEMO_MONGO_PORT", "27018"))
    db_name = os.getenv("DEMO_MONGO_DB", "novamart")

    try:
        client = MongoClient(host, port, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        db.support_tickets.drop()
        db.support_tickets.insert_many(tickets)
        client.close()
        print(f"  [MONGO] Seeded {len(tickets)} tickets @ {host}:{port}/{db_name}")
    except Exception as e:
        print(f"  [MONGO] Could not connect to MongoDB: {e}")
        print("          JSON file is ready for manual import")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="NovaMart demo data generator for Kuantra"
    )
    parser.add_argument("--files-only", action="store_true",
                        help="Only write CSV/Excel/SQL/JSON — skip DB connections")
    parser.add_argument("--customers", type=int,
                        default=DEFAULT_COUNTS["customers"])
    parser.add_argument("--products", type=int,
                        default=DEFAULT_COUNTS["products"])
    parser.add_argument("--orders", type=int,
                        default=DEFAULT_COUNTS["orders"])
    parser.add_argument("--tickets", type=int,
                        default=DEFAULT_COUNTS["tickets"])
    parser.add_argument("--marketing-days", type=int,
                        default=DEFAULT_COUNTS["marketing_days"])
    parser.add_argument("--output-dir", type=str, default=str(OUTPUT_DIR))
    args = parser.parse_args()

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("  NovaMart Demo Data Generator")
    print("=" * 60)

    # --- Generate ---
    print("\n[1/6] Generating customers...")
    customers = gen_customers(args.customers)

    print("[2/6] Generating product catalog & inventory...")
    products = gen_products(args.products)
    inventory = gen_inventory(products)

    print("[3/6] Generating orders & line items...")
    orders, order_items = gen_orders(args.orders, customers, products)

    print("[4/6] Generating support tickets...")
    tickets = gen_tickets(args.tickets, customers, orders)

    print("[5/6] Generating marketing spend...")
    marketing = gen_marketing(args.marketing_days, products)

    # --- Write files ---
    print("\n[6/6] Writing output files...\n")

    # Postgres data -> SQL init script
    write_sql_inserts(out / "init_novamart.sql", customers, orders, order_items)

    # MongoDB data -> JSON
    write_json(out / "support_tickets.json", tickets)

    # CSV sources (product catalog + inventory)
    write_csv(out / "product_catalog.csv", products)
    write_csv(out / "inventory.csv", inventory)

    # Excel source (marketing spend)
    write_excel(out / "marketing_spend.xlsx", {"Daily Spend": marketing})

    # --- Optionally seed live databases ---
    if not args.files_only:
        print("\n  Seeding databases (set --files-only to skip)...\n")
        seed_postgres(out / "init_novamart.sql")
        seed_mongo(tickets)

    # --- Summary ---
    print("\n" + "=" * 60)
    print("  NovaMart demo data ready!")
    print("=" * 60)
    print(f"""
  Shared Keys
  -----------
  customer_id  CUST-000001 .. CUST-{args.customers:06d}
  product_id   PROD-000001 .. PROD-{args.products:06d}
  order_id     ORD-000001  .. ORD-{args.orders:06d}

  Source Mapping
  --------------
  Postgres   ->  novamart.customers, novamart.orders, novamart.order_items
  MongoDB    ->  novamart.support_tickets
  CSV files  ->  product_catalog.csv, inventory.csv
  Excel      ->  marketing_spend.xlsx (sheet: Daily Spend)

  Files written to: {out}
""")


if __name__ == "__main__":
    main()
