import { useState } from 'react';
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import es from 'react-phone-number-input/locale/es';

export default function TelefonoInput({ value, onChange, placeholder, required, className, defaultCountry = "VE" }) {
  const [country, setCountry] = useState(defaultCountry);

  // Generamos un placeholder dinámico basado en el país seleccionado
  // Si no hay país (ej. borraron todo), mostramos el genérico.
  const dynamicPlaceholder = country 
    ? `Ej. +${getCountryCallingCode(country)} ...`
    : (placeholder || "Ej. +58 412 1234567");

  return (
    <PhoneInput
      international
      defaultCountry={defaultCountry}
      country={country}
      onCountryChange={setCountry}
      value={value}
      onChange={onChange}
      placeholder={dynamicPlaceholder}
      required={required}
      className={className}
      labels={es}
      limitMaxLength={true}
    />
  );
}
