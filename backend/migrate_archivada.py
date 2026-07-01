import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from app.db import get_connection

SQL = "ALTER TABLE actividades ADD COLUMN IF NOT EXISTS archivada BOOLEAN DEFAULT FALSE"

# Migrar esquema configurado (dev o public)
try:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    conn.close()
    schema = os.getenv("DB_SCHEMA", "public")
    print(f"✅ Columna archivada agregada en esquema '{schema}'")
except Exception as e:
    print("Error:", e)
