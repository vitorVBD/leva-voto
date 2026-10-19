const EARTH_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function chaveTexto(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chaveSecao(uf: string, municipio: string, zona: string, secao: string): string {
  return [uf.toUpperCase(), chaveTexto(municipio), normalizeNumero(zona), normalizeNumero(secao)].join('|');
}

export function normalizeNumero(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+/, '') || '0';
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export function telefoneValido(telefone: string): boolean {
  const digits = onlyDigits(telefone);
  return digits.length === 10 || digits.length === 11;
}

export function whatsappLink(telefone: string): string {
  let digits = onlyDigits(telefone);
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}
