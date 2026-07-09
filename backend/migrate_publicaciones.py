import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
DB_SCHEMA = os.environ.get("DB_SCHEMA", "dev")

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print(f"Setting search_path to {DB_SCHEMA}")
    cursor.execute(f"SET search_path TO {DB_SCHEMA}")
    
    try:
        print("Adding columns to publicaciones...")
        cursor.execute("ALTER TABLE publicaciones ADD COLUMN archivo_url TEXT;")
        cursor.execute("ALTER TABLE publicaciones ADD COLUMN archivo_nombre TEXT;")
        print("Columns added successfully.")
    except Exception as e:
        print(f"Error (might already exist): {e}")

    conn.close()

if __name__ == "__main__":
    migrate()
