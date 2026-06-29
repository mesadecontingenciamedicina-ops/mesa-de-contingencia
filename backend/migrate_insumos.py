"""Create insumos table and populate from PDF in both schemas."""
import os, re
from dotenv import load_dotenv
import pymssql
import pdfplumber

load_dotenv()

PDF_PATH = os.path.join(os.path.dirname(__file__), "..",
                        "Listado de Medicamentos Esenciales Venezuela FINAL.pdf")

def parse_float(val):
    if not val: return None
    try: return float(str(val).replace(",", ".").strip())
    except: return None

def parse_int(val):
    if not val: return None
    try: return int(str(val).strip())
    except: return None

def extract_rows():
    rows = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    # Skip header rows and empty rows
                    if not row or not row[0]: continue
                    codigo = parse_int(row[0])
                    if codigo is None: continue
                    nombre      = (row[1] or "").strip() or None
                    forma       = (row[2] or "").strip() or None
                    conc        = (row[3] or "").strip() or None
                    vol         = (row[4] or "").strip() or None
                    disp        = parse_int(row[5])
                    prior       = parse_int(row[6])
                    precio      = parse_float(row[7])
                    fabricacion = parse_int(row[8])
                    obs         = (row[9] or "").strip() or None
                    rows.append((codigo, nombre, forma, conc, vol, disp, prior, precio, fabricacion, obs))
    return rows

conn = pymssql.connect(
    server=os.getenv("DB_SERVER"), user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"), database=os.getenv("DB_NAME"),
    tds_version="7.4",
)
cur = conn.cursor()

rows = extract_rows()
print(f"Filas extraidas del PDF: {len(rows)}")
print("Muestra:", rows[:3])

for schema in ["MesaDeContingencia", "MesaDeContingenciaTest"]:
    print(f"\nMigrando {schema}...")
    # Crear tabla
    try:
        cur.execute(f"""
            CREATE TABLE {schema}.insumos (
                id               INT IDENTITY(1,1) PRIMARY KEY,
                codigo           INT,
                nombre           NVARCHAR(200),
                forma_farmaceutica NVARCHAR(100),
                concentracion    NVARCHAR(100),
                volumen_peso     NVARCHAR(100),
                disponibilidad   TINYINT,
                prioridad        TINYINT,
                precio_referencial DECIMAL(10,4),
                fabricacion      TINYINT,
                observacion      NVARCHAR(500)
            )
        """)
        conn.commit()
        print("  Tabla creada.")
    except Exception as e:
        conn.rollback()
        print(f"  Tabla ya existe o error: {e}")
        # Limpiar si ya existe para reinsertar
        try:
            cur.execute(f"DELETE FROM {schema}.insumos")
            conn.commit()
            print("  Datos anteriores eliminados.")
        except: conn.rollback()

    # Insertar datos
    inserted = 0
    for r in rows:
        try:
            cur.execute(f"""
                INSERT INTO {schema}.insumos
                    (codigo, nombre, forma_farmaceutica, concentracion, volumen_peso,
                     disponibilidad, prioridad, precio_referencial, fabricacion, observacion)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, r)
            inserted += 1
        except Exception as e:
            print(f"  Error en fila {r[0]}: {e}")
    conn.commit()
    print(f"  Insertados: {inserted} insumos.")

conn.close()
print("\nDone.")
