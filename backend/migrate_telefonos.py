import sys
import os

# Asegurar que se puede importar app.db
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_connection

def normalize_phone(phone):
    if not phone:
        return phone
    # Limpiar caracteres que no sean digitos o +
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    if not cleaned:
        return phone
    # Si empieza por 0 y tiene 11 digitos, asumir Venezuela
    if cleaned.startswith('0') and len(cleaned) == 11:
        return '+58' + cleaned[1:]
    return cleaned

def migrate():
    print("Iniciando migración de teléfonos...")
    conn = get_connection()
    cur = conn.cursor()
    
    # Miembros
    cur.execute("SELECT id, telefono, tlf_alternativo FROM miembros")
    miembros = cur.fetchall()
    count_miembros = 0
    for m_id, tel, alt in miembros:
        n_tel = normalize_phone(tel)
        n_alt = normalize_phone(alt)
        if n_tel != tel or n_alt != alt:
            cur.execute("UPDATE miembros SET telefono=%s, tlf_alternativo=%s WHERE id=%s", (n_tel, n_alt, m_id))
            count_miembros += 1

    # Centro Contactos
    cur.execute("SELECT id, telefono FROM centro_contactos")
    contactos = cur.fetchall()
    count_contactos = 0
    for c_id, tel in contactos:
        n_tel = normalize_phone(tel)
        if n_tel != tel:
            cur.execute("UPDATE centro_contactos SET telefono=%s WHERE id=%s", (n_tel, c_id))
            count_contactos += 1

    # Solicitudes
    cur.execute("SELECT id, receptor_telefono FROM solicitudes")
    solicitudes = cur.fetchall()
    count_solicitudes = 0
    for s_id, tel in solicitudes:
        n_tel = normalize_phone(tel)
        if n_tel != tel:
            cur.execute("UPDATE solicitudes SET receptor_telefono=%s WHERE id=%s", (n_tel, s_id))
            count_solicitudes += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Migración completada. Actualizados: Miembros ({count_miembros}), Contactos ({count_contactos}), Solicitudes ({count_solicitudes})")

if __name__ == "__main__":
    migrate()
