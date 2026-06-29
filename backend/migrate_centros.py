"""Migración: centros de atención"""
import pymssql, os
from dotenv import load_dotenv
load_dotenv()

conn = pymssql.connect(
    server=os.getenv("DB_SERVER"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    tds_version="7.4",
)
cur = conn.cursor()

cur.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA='MesaDeContingencia' AND TABLE_NAME='centros_atencion'
)
CREATE TABLE MesaDeContingencia.centros_atencion (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombre      NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(300) NULL,
    activo      BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE()
)
""")

cur.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='MesaDeContingencia' AND TABLE_NAME='usuarios' AND COLUMN_NAME='centro_id'
)
ALTER TABLE MesaDeContingencia.usuarios ADD centro_id INT NULL
    REFERENCES MesaDeContingencia.centros_atencion(id)
""")

cur.execute("""
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='MesaDeContingencia' AND TABLE_NAME='solicitudes' AND COLUMN_NAME='creado_por_centro_id'
)
ALTER TABLE MesaDeContingencia.solicitudes ADD creado_por_centro_id INT NULL
    REFERENCES MesaDeContingencia.centros_atencion(id)
""")

conn.commit()
conn.close()
print("Migración centros completada.")
