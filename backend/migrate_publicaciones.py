import os
import psycopg2
from dotenv import load_dotenv

# Cargar variables de entorno (por si se ejecuta localmente con .env)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL no está definida.")
    exit(1)

def migrate():
    print(f"Conectando a {DATABASE_URL.split('@')[-1]}...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("Creando tabla publicaciones...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS publicaciones (
            id              SERIAL PRIMARY KEY,
            descripcion     TEXT NOT NULL,
            autor_username  VARCHAR(100) NOT NULL,
            grupo_id        INT REFERENCES grupos_trabajo(id) ON DELETE SET NULL,
            eliminada       BOOLEAN DEFAULT FALSE,
            fecha_creacion  TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    conn.commit()
    print("✅ Tabla publicaciones creada correctamente.")
    conn.close()

if __name__ == "__main__":
    migrate()
