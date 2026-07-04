import { isValidPhoneNumber } from 'react-phone-number-input';

export function validarTelefono(valor) {
  if (!valor) return null; // opcional
  if (!isValidPhoneNumber(valor)) return "Número de teléfono internacional inválido.";
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
