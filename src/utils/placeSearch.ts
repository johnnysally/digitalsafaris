import searchApi from "../api/searchApi";
import type { Location } from "../types";

export interface PlaceSuggestion {
  address: string;
  town: string;
  latitude: number;
  longitude: number;
}

let operationalLocations: Location[] | null = null;
let locationsRequest: Promise<Location[]> | null = null;

function getOperationalLocations(): Promise<Location[]> {
  if (operationalLocations) return Promise.resolve(operationalLocations);
  if (!locationsRequest) {
    locationsRequest = searchApi
      .locations({ isOperational: true })
      .then((locations) => {
        operationalLocations = locations;
        return locations;
      })
      .catch((error: unknown) => {
        locationsRequest = null;
        throw error;
      });
  }
  return locationsRequest;
}

function asSuggestion(location: Location): PlaceSuggestion | null {
  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  const town =
    location.type === "country" || location.type === "county"
      ? location.county || location.name
      : location.name;
  const address =
    location.county && location.county !== location.name
      ? `${location.name}, ${location.county}`
      : location.name;

  return {
    address,
    town,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
}

function distanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, value)));
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  checkAborted(signal);
  const locations = await getOperationalLocations();
  checkAborted(signal);

  return locations
    .filter((location) =>
      `${location.name} ${location.county ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
    .map(asSuggestion)
    .filter((place): place is PlaceSuggestion => Boolean(place));
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<PlaceSuggestion | null> {
  checkAborted(signal);
  const locations = (await getOperationalLocations())
    .map((location) => {
      const place = asSuggestion(location);
      if (!place) return null;
      return {
        place,
        radiusKm: location.radiusKm,
        distance: distanceKm({ latitude, longitude }, place),
      };
    })
    .filter(
      (
        result
      ): result is {
        place: PlaceSuggestion;
        radiusKm: number;
        distance: number;
      } => Boolean(result)
    )
    .sort((first, second) => first.distance - second.distance);
  checkAborted(signal);

  const nearest = locations[0];
  if (!nearest || nearest.distance > nearest.radiusKm) return null;
  return {
    ...nearest.place,
    address: `Near ${nearest.place.address}`,
  };
}
