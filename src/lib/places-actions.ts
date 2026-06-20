'use server'

import { logger } from '@/lib/logger'

const PLACES_BASE = 'https://places.googleapis.com/v1'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

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

// ── Nominatim fallback (no API key required) ─────────────────────────────────

const US_STATES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
  Wisconsin: 'WI', Wyoming: 'WY',
}

function toStateAbbr(name: string): string {
  if (!name) return ''
  if (name.length === 2) return name.toUpperCase()
  return US_STATES[name] ?? name
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    hamlet?: string
    state?: string
    postcode?: string
    country_code?: string
  }
}

function nominatimToSuggestion(item: NominatimResult): PlaceSuggestion {
  const a = item.address
  const line1 = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? ''
  const state = toStateAbbr(a.state ?? '')
  const zip = a.postcode ?? ''
  const description = [line1, city, state, zip].filter(Boolean).join(', ')

  const parsed: ParsedAddress = {
    addressLine1: line1,
    city,
    state,
    postalCode: zip,
    country: a.country_code?.toUpperCase() ?? 'US',
    latitude: item.lat,
    longitude: item.lon,
  }
  // Encode the full parsed address into the placeId so getPlaceDetailsAction
  // requires no second network call for Nominatim results.
  const encoded = Buffer.from(JSON.stringify(parsed)).toString('base64')
  return { placeId: `nominatim:${encoded}`, description }
}

async function searchNominatim(query: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ q: query, format: 'json', addressdetails: '1', countrycodes: 'us', limit: '6' })
  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'TorsionDesk-CRM/1.0' },
  })
  const data: NominatimResult[] = await res.json()
  return data.filter((item) => item.address?.road).map(nominatimToSuggestion)
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function searchPlacesAction(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim() || query.length < 3) return []

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    try {
      return await searchNominatim(query)
    } catch (e) {
      logger.error('Places:nominatim', e)
      return []
    }
  }

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
      logger.error('Places:autocomplete', `HTTP ${res.status}: ${err}`)
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
    logger.error('Places:autocomplete', e)
    return []
  }
}

export async function getPlaceDetailsAction(placeId: string): Promise<ParsedAddress | null> {
  if (!placeId) return null

  // Nominatim results carry the parsed address encoded in the placeId itself
  if (placeId.startsWith('nominatim:')) {
    try {
      const json = Buffer.from(placeId.replace('nominatim:', ''), 'base64').toString('utf8')
      return JSON.parse(json) as ParsedAddress
    } catch {
      return null
    }
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null

  try {
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'addressComponents,location',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      logger.error('Places:details', `HTTP ${res.status}: ${err}`)
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
    logger.error('Places:details', e)
    return null
  }
}
