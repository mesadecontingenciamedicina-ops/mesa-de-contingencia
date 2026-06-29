const PREFIJOS_MOVIL = ["0412", "0414", "0416", "0424", "0426"];
const PREFIJOS_FIJO  = ["0212", "0234", "0237", "0238", "0239",
                        "0241", "0242", "0243", "0244", "0245",
                        "0246", "0247", "0248", "0249", "0251",
                        "0252", "0253", "0254", "0255", "0256",
                        "0257", "0258", "0259", "0261", "0262",
                        "0263", "0264", "0265", "0266", "0267",
                        "0268", "0269", "0271", "0272", "0273",
                        "0274", "0275", "0276", "0277", "0278",
                        "0279", "0281", "0283", "0285", "0286",
                        "0287", "0288", "0289", "0291", "0292",
                        "0293", "0294", "0295", "0299"];
const TODOS_PREFIJOS = [...PREFIJOS_MOVIL, ...PREFIJOS_FIJO];

// Acepta: 04XX-XXXXXXX, 04XXXXXXXXX, 02XX-XXXXXXX, 02XXXXXXXXX
export function validarTelefono(valor) {
  if (!valor) return null; // opcional
  const limpio = valor.replace(/[\s\-]/g, "");
  if (!/^\d{11}$/.test(limpio)) return "Debe tener 11 dígitos (ej. 0412-1234567).";
  const prefijo = limpio.slice(0, 4);
  if (!TODOS_PREFIJOS.includes(prefijo))
    return `Prefijo inválido. Móviles: ${PREFIJOS_MOVIL.join(", ")}.`;
  return null;
}

export function validarEmail(valor) {
  if (!valor) return null; // opcional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(valor)) return "Correo electrónico inválido.";
  return null;
}

export function normalizarCedula(valor) {
  if (!valor) return valor;
  const limpio = valor.trim().replace(/\s/g, "");
  if (/^\d{6,8}$/.test(limpio)) return `V-${limpio}`;
  return limpio;
}

export function validarCedula(valor) {
  if (!valor || !valor.trim()) return null; // opcional
  const limpio = normalizarCedula(valor);
  if (!/^[VvEe]-?\d{6,8}$/.test(limpio))
    return "Debe iniciar con V o E. Ej: V-12345678.";
  return null;
}

export function validarFormMiembro(f) {
  const errores = {};
  if (!f.nombre.trim()) errores.nombre = "El nombre es obligatorio.";

  const eCed = validarCedula(f.cedula);
  if (eCed) errores.cedula = eCed;

  if (!f.telefono.trim())         errores.telefono = "El teléfono principal es obligatorio.";
  else { const e = validarTelefono(f.telefono); if (e) errores.telefono = e; }

  if (f.tlf_alternativo?.trim()) { const e = validarTelefono(f.tlf_alternativo); if (e) errores.tlf_alternativo = e; }

  if (!f.email.trim())            errores.email = "El correo es obligatorio.";
  else { const e = validarEmail(f.email); if (e) errores.email = e; }

  if (!f.cargo) errores.cargo = "El cargo es obligatorio.";

  return errores;
}
