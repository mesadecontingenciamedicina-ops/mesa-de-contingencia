import os
import sys

# Agregar el directorio backend al PYTHONPATH para poder importar app.db
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
# Cargar .env de la raíz
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from app.db import get_connection

try:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE grupos_trabajo ADD COLUMN IF NOT EXISTS es_coordinador BOOLEAN DEFAULT FALSE")
    conn.commit()
    conn.close()
    print("✅ Columna es_coordinador agregada")
except Exception as e:
    print("Error:", e)
