import re

PREFIJOS = {"0412","0414","0416","0424","0426",
            "0212","0234","0237","0238","0239",
            "0241","0242","0243","0244","0245","0246","0247","0248","0249",
            "0251","0252","0253","0254","0255","0256","0257","0258","0259",
            "0261","0262","0263","0264","0265","0266","0267","0268","0269",
            "0271","0272","0273","0274","0275","0276","0277","0278","0279",
            "0281","0283","0285","0286","0287","0288","0289",
            "0291","0292","0293","0294","0295","0299"}

CARGOS = {"Profesor","Estudiante","BR","Auxiliar","Voluntario"}

def validar_telefono(valor):
    if not valor:
        return None
    limpio = re.sub(r"[\s\-]", "", valor)
    if not re.fullmatch(r"\d{11}", limpio):
        return "Debe tener 11 dígitos (ej. 0412-1234567)."
    if limpio[:4] not in PREFIJOS:
        return f"Prefijo inválido. Móviles: 0412, 0414, 0416, 0424, 0426."
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

def validar_miembro(data):
    errores = {}
    if not data.get("nombre", "").strip():
        errores["nombre"] = "El nombre es obligatorio."
    if data.get("cedula", "").strip():
        e = validar_cedula(data.get("cedula"))
        if e: errores["cedula"] = e
    if not data.get("telefono", "").strip():
        errores["telefono"] = "El teléfono principal es obligatorio."
    else:
        e = validar_telefono(data.get("telefono"))
        if e: errores["telefono"] = e
    if data.get("tlf_alternativo", "").strip():
        e = validar_telefono(data.get("tlf_alternativo"))
        if e: errores["tlf_alternativo"] = e
    if not data.get("email", "").strip():
        errores["email"] = "El correo es obligatorio."
    else:
        e = validar_email(data.get("email"))
        if e: errores["email"] = e
    if not data.get("cargo", "").strip():
        errores["cargo"] = "El cargo es obligatorio."
    elif data.get("cargo") not in CARGOS:
        errores["cargo"] = f"Cargo inválido. Opciones: {', '.join(CARGOS)}."
    return errores
