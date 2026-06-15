'use server'

const PLACES_BASE = 'https://places.googleapis.com/v1'

export interface PlaceSuggestion {
  placeId: string
  description: string
}

export interface ParsedAddress {
  addressLine1: string
  city: string
  state: string
  postalCode: string
  country: string
  latitude: string
  longitude: string
}

export async function searchPlacesAction(query: string): Promise<PlaceSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('[Places] GOOGLE_MAPS_API_KEY is not set')
    return []
  }
  if (!query.trim() || query.length < 3) return []

  try {
    const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['us'],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Places] Autocomplete error ${res.status}:`, err)
      return []
    }

    const data = await res.json()
    const suggestions: PlaceSuggestion[] = (data.suggestions ?? [])
      .map((s: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => ({
        placeId: s.placePrediction?.placeId ?? '',
        description: s.placePrediction?.text?.text ?? '',
      }))
      .filter((s: PlaceSuggestion) => s.placeId && s.description)
    return suggestions
  } catch (e) {
    console.error('[Places] Autocomplete fetch failed:', e)
    return []
  }
}

export async function getPlaceDetailsAction(placeId: string): Promise<ParsedAddress | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || !placeId) return null

  try {
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'addressComponents,location',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Places] Details error ${res.status}:`, err)
      return null
    }

    const data = await res.json()

    type Component = { longText: string; shortText: string; types: string[] }
    const components: Component[] = data.addressComponents ?? []
    const get = (type: string, short = false) =>
      components.find((c) => c.types.includes(type))?.[short ? 'shortText' : 'longText'] ?? ''

    const streetNumber = get('street_number')
    const route = get('route')
    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ')
    const city = get('locality') || get('sublocality') || get('postal_town')
    const state = get('administrative_area_level_1', true)
    const postalCode = get('postal_code')
    const country = get('country')

    return {
      addressLine1,
      city,
      state,
      postalCode,
      country,
      latitude: data.location?.latitude?.toString() ?? '',
      longitude: data.location?.longitude?.toString() ?? '',
    }
  } catch (e) {
    console.error('[Places] Details fetch failed:', e)
    return null
  }
}
