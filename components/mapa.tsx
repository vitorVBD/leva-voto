export function Mapa({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <iframe
      title={`Mapa de ${nome}`}
      src={src}
      className="h-64 w-full rounded-lg border border-border"
    />
  );
}
