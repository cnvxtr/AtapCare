const cache = new Map<string, string>()

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`
  if (cache.has(key)) return cache.get(key)!
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      { headers: { 'Accept-Language': 'id' } }
    )
    const data = await res.json()
    const name: string = data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    cache.set(key, name)
    return name
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
  }
}
