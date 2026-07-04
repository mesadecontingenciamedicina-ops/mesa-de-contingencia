import re
import phonenumbers

CARGOS = {"Profesor","Estudiante","BR","Auxiliar","Voluntario"}

def validar_telefono(valor):
    if not valor:
        return None
        
    # Excepción: Permitir el nuevo código 0422 de Digitel (Venezuela) que puede no estar en la librería aún
    limpio = valor.replace(" ", "")
    if limpio.startswith("+58422") and len(limpio) == 13:
        return None
        
    try:
        parsed = phonenumbers.parse(valor, None)
        if not phonenumbers.is_valid_number(parsed):
            return "Número de teléfono internacional inválido."
    except phonenumbers.NumberParseException:
        return "Formato inválido. Asegúrese de incluir el código de país (ej. +58)."
    return None

def validar_email(valor):
    if not valor:
        return None
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", valor):
        return "Correo electrónico inválido."
    return None

def normalizar_cedula(valor):
    """Si solo tiene dígitos, agrega V- por defecto."""
    if not valor:
        return valor
    limpio = valor.strip().replace(" ", "")
    if re.fullmatch(r"\d{6,8}", limpio):
        return f"V-{limpio}"
    return limpio

def validar_cedula(valor):
    if not valor or not valor.strip():
        return "La cédula es obligatoria."
    limpio = normalizar_cedula(valor)
    if not re.fullmatch(r"[VvEe]-?\d{6,8}", limpio):
        return "Debe iniciar con V o E. Ej: V-12345678."
    return None

def _s(val):
    """Safely strip a value that may be None."""
    return (val or "").strip()

def validar_miembro(data):
    errores = {}
    if not _s(data.get("nombre")):
        errores["nombre"] = "El nombre es obligatorio."
    if _s(data.get("cedula")):
        e = validar_cedula(data.get("cedula"))
        if e: errores["cedula"] = e
    if not _s(data.get("telefono")):
        errores["telefono"] = "El teléfono principal es obligatorio."
    else:
        e = validar_telefono(data.get("telefono"))
        if e: errores["telefono"] = e
    if _s(data.get("tlf_alternativo")):
        e = validar_telefono(data.get("tlf_alternativo"))
        if e: errores["tlf_alternativo"] = e
    if not _s(data.get("email")):
        errores["email"] = "El correo es obligatorio."
    else:
        e = validar_email(data.get("email"))
        if e: errores["email"] = e
    if not _s(data.get("cargo")):
        errores["cargo"] = "El cargo es obligatorio."
    elif data.get("cargo") not in CARGOS:
        errores["cargo"] = f"Cargo inválido. Opciones: {', '.join(CARGOS)}."
    return errores
