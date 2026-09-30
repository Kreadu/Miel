/**
 * S20-05: las categorías que trae Miel (`seed_expense_categories`) se guardan en español; se
 * traducen al mostrarlas por su nombre exacto. Las propias o renombradas se muestran tal cual.
 */
const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
  Arriendo: "rent",
  "Servicios públicos (agua, luz, gas)": "utilities",
  "Internet y telefonía": "internetPhone",
  "Artículos de oficina y papelería": "officeSupplies",
  "Aseo y limpieza": "cleaning",
  "Mobiliario y equipos (mantenimiento)": "furnitureMaintenance",
  "Herramientas y maquinaria (mantenimiento)": "toolsMaintenance",
  Seguros: "insurance",
  "Contabilidad y asesorías": "accounting",
  "Software y suscripciones": "software",
  "Impuestos y licencias": "taxesLicenses",
  "Vigilancia y seguridad": "security",
  "Cuotas de crédito o leasing": "loanPayments",
  "Depreciación y amortización": "depreciation",
  "Intereses y gastos financieros": "interest",
  "Impuesto de renta": "incomeTax",
  "Transporte y envíos": "transport",
  Combustible: "fuel",
  "Mantenimiento de vehículos": "vehicleMaintenance",
  "Publicidad y marketing": "marketing",
  "Comisiones de venta": "salesCommissions",
  "Empaques y bolsas": "packaging",
  "Comisiones bancarias y datáfono": "bankFees",
  "Viáticos y alimentación": "travelMeals",
  "Reparaciones imprevistas": "repairs",
  // Categoría que usa Finanzas para la nómina clasificada como gasto (monthly_expenses).
  Nómina: "payroll",
};

export function defaultCategoryKey(name: string): string | null {
  return DEFAULT_CATEGORY_KEYS[name] ?? null;
}

/** Nombre a mostrar: `t` es el traductor del namespace `expenses`. */
export function categoryLabel(name: string, t: (key: string) => string): string {
  const key = defaultCategoryKey(name);
  return key ? t(`categories.${key}`) : name;
}
