import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon,
  MapPin,
  Navigation,
  Car,
  Clock,
  Phone,
  Radio,
  Route,
  ShieldCheck,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Alert from "../components/ui/Alert";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import LiveTripMap from "../components/LiveTripMap";
import { trackingApi } from "../api";
import { useSocket } from "../context/socketContext";
import { formatDateTime, formatRelative } from "../utils/formatDate";
import { capitalize } from "../utils/helpers";
import type { TrackingLocation, TripStatus } from "../types";
import type {
  TrackBookingResponse,
  TrackTripResponse,
  TrackDeliveryResponse,
} from "../types";

type Kind = "booking" | "trip" | "delivery";
type TrailPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function distanceMeters(
  first: Pick<TrailPoint, "latitude" | "longitude">,
  second: Pick<TrailPoint, "latitude" | "longitude">
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(value));
}

function tripStatusLabel(status: TripStatus): string {
  switch (status) {
    case "requested":
      return "Finding your driver";
    case "accepted":
      return "Your driver is on the way";
    case "ongoing":
      return "Your ride is underway";
    case "completed":
      return "Trip complete";
    case "cancelled":
      return "Trip cancelled";
    case "failed":
      return "Trip could not be completed";
  }
}

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>(
    searchParams.get("kind") === "trip" ? "trip" : "booking"
  );
  const [reference, setReference] = useState(
    searchParams.get("reference") ?? ""
  );
  const { connected, emit, off, on, socket } = useSocket();

  const [booking, setBooking] = useState<TrackBookingResponse | null>(null);
  const [trip, setTrip] = useState<TrackTripResponse | null>(null);
  const [delivery, setDelivery] = useState<TrackDeliveryResponse | null>(null);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [subscriptionReady, setSubscriptionReady] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTripReference = trip?.trip.reference;
  const activeTripStatus = trip?.trip.status;
  const terminalTrip =
    activeTripStatus === "completed" ||
    activeTripStatus === "cancelled" ||
    activeTripStatus === "failed";

  const activeDestination =
    trip?.trip.status === "accepted"
      ? trip.trip.pickup
      : trip?.trip.status === "ongoing"
        ? trip.trip.dropoff
        : null;
  const directDistanceKm =
    trip?.location &&
    typeof activeDestination?.latitude === "number" &&
    typeof activeDestination.longitude === "number"
      ? distanceMeters(trip.location, {
          latitude: activeDestination.latitude,
          longitude: activeDestination.longitude,
        }) / 1000
      : null;
  const trailDistanceKm = trail
    .slice(1)
    .reduce(
      (distance, point, index) => distance + distanceMeters(trail[index], point),
      0
    ) / 1000;

  const recordLocation = useCallback((location: TrackingLocation) => {
    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      Math.abs(location.latitude) > 90 ||
      Math.abs(location.longitude) > 180
    ) {
      return;
    }
    setTrail((previous) => {
      const last = previous[previous.length - 1];
      const next = {
        latitude: location.latitude,
        longitude: location.longitude,
        recordedAt: location.lastPingAt || new Date().toISOString(),
      };
      if (
        last &&
        distanceMeters(last, next) < 15 &&
        Date.now() - new Date(last.recordedAt).getTime() < 60000
      ) {
        return previous;
      }
      return [...previous, next].slice(-1000);
    });
  }, []);

  const clearAll = () => {
    setBooking(null);
    setTrip(null);
    setDelivery(null);
    setTrail([]);
    setLiveError(null);
    setSubscriptionReady(false);
  };

  const load = async () => {
    const ref = reference.trim();
    if (!ref) {
      setError("Enter a reference.");
      return;
    }

    setLoading(true);
    setError(null);
    clearAll();

    try {
      if (kind === "booking") {
        const data = await trackingApi.booking(ref);
        setBooking(data);
      } else if (kind === "trip") {
        const data = await trackingApi.trip(ref);
        setTrip(data);
        if (data.location) recordLocation(data.location);
      } else {
        const data = await trackingApi.delivery(ref);
        setDelivery(data);
      }
    } catch {
      setError("Could not find that reference.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryKind = searchParams.get("kind");
    const queryReference = searchParams.get("reference")?.trim();
    if (queryKind !== "trip" || !queryReference) return;

    setKind("trip");
    setReference(queryReference);
    setLoading(true);
    setError(null);
    trackingApi
      .trip(queryReference)
      .then((data) => {
        setTrip(data);
        setTrail([]);
        if (data.location) recordLocation(data.location);
      })
      .catch(() => setError("Could not find that trip reference."))
      .finally(() => setLoading(false));
  }, [recordLocation, searchParams]);

  useEffect(() => {
    if (!activeTripReference || terminalTrip) return;
    const tripReference = activeTripReference;
    let active = true;
    const poll = async () => {
      try {
        const latest = await trackingApi.trip(tripReference);
        if (!active) return;
        setTrip(latest);
        setLiveError(null);
        if (latest.location) recordLocation(latest.location);
      } catch {
        if (active) {
          setLiveError("Connection interrupted. We’ll keep trying to refresh.");
        }
      }
    };
    const interval = window.setInterval(() => void poll(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeTripReference, recordLocation, terminalTrip]);

  useEffect(() => {
    if (!reference.trim() || kind === "trip") return;
    let active = true;
    const poll = async () => {
      try {
        if (kind === "booking") {
          const latest = await trackingApi.booking(reference.trim());
          if (active) setBooking(latest);
        } else {
          const latest = await trackingApi.delivery(reference.trim());
          if (active) setDelivery(latest);
        }
      } catch {
        if (active) setLiveError("Could not refresh this tracking result.");
      }
    };
    const interval = window.setInterval(() => void poll(), 20000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [kind, reference]);

  useEffect(() => {
    if (!activeTripReference) return;
    if (terminalTrip) {
      setSubscriptionReady(false);
      return;
    }
    const tripReference = activeTripReference;
    const readLocation = (payload: unknown) => {
      if (
        !isRecord(payload) ||
        typeof payload.latitude !== "number" ||
        typeof payload.longitude !== "number" ||
        !Number.isFinite(payload.latitude) ||
        !Number.isFinite(payload.longitude) ||
        Math.abs(payload.latitude) > 90 ||
        Math.abs(payload.longitude) > 180
      ) {
        return;
      }

      const location: TrackingLocation = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading:
          typeof payload.heading === "number" ? payload.heading : undefined,
        speed: typeof payload.speed === "number" ? payload.speed : undefined,
        lastPingAt:
          typeof payload.lastPingAt === "string"
            ? payload.lastPingAt
            : new Date().toISOString(),
      };
      setTrip((current) =>
        current?.trip.reference === tripReference
          ? { ...current, location }
          : current
      );
      recordLocation(location);
      setLiveError(null);
    };
    const readTrackingError = (payload: unknown) => {
      if (
        isRecord(payload) &&
        payload.reference === tripReference &&
        typeof payload.message === "string"
      ) {
        setSubscriptionReady(false);
        setLiveError(payload.message);
      }
    };
    const readTrackingReady = (payload: unknown) => {
      if (isRecord(payload) && payload.reference === tripReference) {
        setSubscriptionReady(true);
        setLiveError(null);
      }
    };
    const readTripStatus = (status: "ongoing" | "completed" | "cancelled") =>
      (payload: unknown) => {
        if (!isRecord(payload) || payload.reference !== tripReference) return;
        setTrip((current) =>
          current?.trip.reference === tripReference
            ? { ...current, trip: { ...current.trip, status } }
            : current
        );
      };

    const tripStarted = readTripStatus("ongoing");
    const tripCompleted = readTripStatus("completed");
    const tripCancelled = readTripStatus("cancelled");
    setSubscriptionReady(false);
    on("driver:location", readLocation);
    on("trip:tracking-ready", readTrackingReady);
    on("trip:tracking-error", readTrackingError);
    on("trip:started", tripStarted);
    on("trip:completed", tripCompleted);
    on("trip:cancelled", tripCancelled);
    if (connected) emit("trip:subscribe", tripReference);

    return () => {
      off("driver:location", readLocation);
      off("trip:tracking-ready", readTrackingReady);
      off("trip:tracking-error", readTrackingError);
      off("trip:started", tripStarted);
      off("trip:completed", tripCompleted);
      off("trip:cancelled", tripCancelled);
      if (socket?.connected) emit("trip:unsubscribe", tripReference);
    };
  }, [
    activeTripReference,
    connected,
    emit,
    off,
    on,
    recordLocation,
    socket,
    terminalTrip,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Tracking</h1>
        <p className="mt-1 text-sm text-text-muted">
          {kind === "trip"
            ? "Follow your driver to pickup and see your trip unfold on the map."
            : "Enter a booking, trip, or delivery reference to see its latest status."}
        </p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            options={[
              { label: "Booking", value: "booking" },
              { label: "Trip", value: "trip" },
              { label: "Delivery", value: "delivery" },
            ]}
          />
          <div className="md:col-span-2">
            <Input
              placeholder="e.g. BKG-XXXX or ORD-XXXX"
              leftIcon={<SearchIcon className="h-4 w-4" />}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <Button type="submit" fullWidth loading={loading}>
            Track
          </Button>
        </form>
      </Card>

      {error && (
        <Alert variant="danger" title="Not found">
          {error}
        </Alert>
      )}
      {liveError && (
        <Alert variant="info" title="Tracking update">
          {liveError}
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && booking && (
        <Card title="Booking">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-text-primary">{booking.reference}</p>
              <Badge variant="info">
                {capitalize(booking.status.replace(/_/g, " "))}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-text-muted">Check-in</p>
                <p className="text-text-primary">
                  {formatDateTime(booking.checkIn)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Check-out</p>
                <p className="text-text-primary">
                  {formatDateTime(booking.checkOut)}
                </p>
              </div>
            </div>
            {booking.property && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted">Property</p>
                  <p className="text-text-primary">{booking.property.name}</p>
                  <p className="text-xs text-text-secondary">
                    {booking.property.address}
                  </p>
                </div>
              </div>
            )}
            {booking.qrCode && (
              <div className="rounded-md border border-border bg-surface-alt p-3">
                <p className="text-xs text-text-muted">Check-in code</p>
                <p className="font-mono text-sm text-text-primary">
                  {booking.qrCode}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {!loading && trip && (
        <div className="space-y-4">
          <Card
            title={`Live trip · ${trip.trip.reference}`}
            actions={
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Radio
                  className={`size-4 ${
                    subscriptionReady
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                />
                {subscriptionReady
                  ? "Realtime updates"
                  : connected
                    ? "Connecting to trip"
                    : "Reconnecting"}
              </span>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-lg font-semibold text-text-primary">
                    {tripStatusLabel(trip.trip.status)}
                  </p>
                  <p className="mb-0 mt-1 text-xs text-text-muted">
                    {trip.trip.status === "requested"
                      ? "We’ll show the vehicle here as soon as a driver accepts your trip."
                      : trip.trip.status === "accepted"
                        ? "Watch the vehicle travel to your pickup point."
                        : trip.trip.status === "ongoing"
                          ? "Your live route trail is recorded as the vehicle moves."
                          : "You can still review the trip route and last known location."}
                  </p>
                </div>
                <Badge
                  variant={
                    trip.trip.status === "completed"
                      ? "success"
                      : trip.trip.status === "cancelled" ||
                          trip.trip.status === "failed"
                        ? "danger"
                        : trip.trip.status === "requested"
                          ? "warning"
                          : "info"
                  }
                >
                  {capitalize(trip.trip.status.replace(/_/g, " "))}
                </Badge>
              </div>

              <LiveTripMap
                pickup={trip.trip.pickup}
                dropoff={trip.trip.dropoff}
                location={trip.location}
                trail={trail}
                status={trip.trip.status}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-start gap-3 rounded-xl bg-[#f5f8f2] p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f1e7] text-[#55764d]">
                    <Navigation className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Pickup
                    </p>
                    <p className="mb-0 mt-1 truncate text-sm font-medium text-text-primary">
                      {trip.trip.pickup?.address || "Pickup location"}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-3 rounded-xl bg-[#fff8ee] p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7ead8] text-[#9b6529]">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Destination
                    </p>
                    <p className="mb-0 mt-1 truncate text-sm font-medium text-text-primary">
                      {trip.trip.dropoff?.address || "Destination"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="m-0 inline-flex items-center gap-2 text-xs text-text-muted">
                  <Route className="size-4" />
                  {trip.trip.distanceKm != null
                    ? `${trip.trip.distanceKm.toFixed(1)} km trip`
                    : "Trip route"}
                  {trailDistanceKm > 0.05 &&
                    ` · ${trailDistanceKm.toFixed(1)} km GPS trail`}
                </p>
                {trip.location && (
                  <p className="m-0 text-xs text-text-muted">
                    {directDistanceKm !== null &&
                      `About ${directDistanceKm.toFixed(1)} km direct to ${
                        trip.trip.status === "accepted" ? "pickup" : "destination"
                      } · `}
                    Updated {formatRelative(trip.location.lastPingAt)}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {(trip.trip.driver || trip.trip.vehicle) && (
            <Card title="Your driver and vehicle">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f7ead8] text-[#9b6529]">
                    <Car className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-semibold text-text-primary">
                      {trip.trip.driver
                        ? `${trip.trip.driver.firstName ?? ""} ${trip.trip.driver.lastName ?? ""}`.trim()
                        : "Driver assigned"}
                    </p>
                    <p className="mb-0 mt-1 text-xs text-text-muted">
                      {[
                        trip.trip.vehicle?.color,
                        trip.trip.vehicle?.make,
                        trip.trip.vehicle?.model,
                        trip.trip.vehicle?.plateNumber,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Vehicle details"}
                    </p>
                  </div>
                </div>
                {trip.trip.driver?.phone && (
                  <a
                    href={`tel:${trip.trip.driver.phone}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-alt"
                  >
                    <Phone className="size-4" />
                    Call driver
                  </a>
                )}
              </div>
            </Card>
          )}

          <p className="m-0 flex items-start gap-2 px-1 text-xs leading-relaxed text-text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#6f8c5c]" />
            Live location is shared only while your driver is assigned to this
            trip. GPS updates may pause if the driver loses network coverage.
          </p>
        </div>
      )}

      {!loading && delivery && (
        <Card title="Delivery">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-text-primary">
                {delivery.order.reference}
              </p>
              <Badge variant="info">
                {capitalize(delivery.order.status.replace(/_/g, " "))}
              </Badge>
            </div>
            {delivery.order.restaurant && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted">Restaurant</p>
                  <p className="text-text-primary">
                    {delivery.order.restaurant.name}
                  </p>
                </div>
              </div>
            )}
            {delivery.delivery?.driver && (
              <div className="flex items-start gap-3">
                <Car className="mt-0.5 h-4 w-4 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted">Driver</p>
                  <p className="text-text-primary">
                    {delivery.delivery.driver.firstName}{" "}
                    {delivery.delivery.driver.lastName}
                  </p>
                  {delivery.delivery.driver.phone && (
                    <p className="text-xs text-text-secondary">
                      {delivery.delivery.driver.phone}
                    </p>
                  )}
                </div>
              </div>
            )}
            {delivery.location && (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface-alt p-3">
                <Clock className="h-4 w-4 text-secondary-600" />
                <div>
                  <p className="text-xs text-text-muted">Last ping</p>
                  <p className="font-mono text-xs text-text-primary">
                    {delivery.location.latitude.toFixed(4)},{" "}
                    {delivery.location.longitude.toFixed(4)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatRelative(delivery.location.lastPingAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {!loading && !booking && !trip && !delivery && !error && (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="Nothing to track yet"
          description="Enter a reference to follow it live. Auto-refreshes every 20 seconds."
        />
      )}
    </div>
  );
}