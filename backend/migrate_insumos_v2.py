"""
- Uppercase all insumo names
- Add insumo_id FK to solicitud_items
"""
import os
from dotenv import load_dotenv
import pymssql

load_dotenv()

conn = pymssql.connect(
    server=os.getenv("DB_SERVER"), user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"), database=os.getenv("DB_NAME"),
    tds_version="7.4",
)
cur = conn.cursor()

for schema in ["MesaDeContingencia", "MesaDeContingenciaTest"]:
    print(f"\n{schema}:")

    # 1. Uppercase existing insumos
    cur.execute(f"UPDATE {schema}.insumos SET nombre = UPPER(nombre)")
    conn.commit()
    print(f"  nombres en mayusculas: {cur.rowcount} filas")

    # 2. Add insumo_id to solicitud_items
    try:
        cur.execute(f"""
            ALTER TABLE {schema}.solicitud_items
            ADD insumo_id INT NULL
                REFERENCES {schema}.insumos(id)
        """)
        conn.commit()
        print(f"  insumo_id agregado a solicitud_items")
    except Exception as e:
        conn.rollback()
        print(f"  insumo_id ya existe o error: {e}")

conn.close()
print("\nDone.")
