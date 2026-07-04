import psycopg2

try:
    conn = psycopg2.connect("postgresql://postgres.adtaevgnpcjkhdjanalc:mesadecontingencia2026@db.adtaevgnpcjkhdjanalc.supabase.co:5432/postgres")
    print("Conexión exitosa!")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
