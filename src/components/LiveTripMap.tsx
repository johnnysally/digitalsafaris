import { useState } from "react";
import { LocateFixed, Route } from "lucide-react";
import Button from "./ui/Button";
import type { Address, TrackingLocation, TripStatus } from "../types";

type MapPoint = { latitude: number; longitude: number };
type TrailPoint = MapPoint & { recordedAt: string };
type ViewMode = "trip" | "vehicle";

function isValidPoint(point: Partial<MapPoint> | undefined): point is MapPoint {
  return Boolean(
    point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180
  );
}

function mercatorY(latitude: number): number {
  const clamped = Math.max(-85, Math.min(85, latitude));
  const radians = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function distanceMeters(first: MapPoint, second: MapPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, value)));
}

function markerLabel(point: MapPoint, label: string, color: string) {
  return (
    <g transform={`translate(${point.longitude},${point.latitude})`}>
      <circle r="18" fill={color} stroke="white" strokeWidth="4" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="13"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

export default function LiveTripMap({
  pickup,
  dropoff,
  location,
  trail,
  status,
}: {
  pickup: Address;
  dropoff: Address;
  location: TrackingLocation | null;
  trail: TrailPoint[];
  status: TripStatus;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("trip");
  const pickupPoint = isValidPoint(pickup)
    ? { latitude: pickup.latitude!, longitude: pickup.longitude! }
    : null;
  const dropoffPoint = isValidPoint(dropoff)
    ? { latitude: dropoff.latitude!, longitude: dropoff.longitude! }
    : null;
  const driverPoint = isValidPoint(location ?? undefined)
    ? { latitude: location!.latitude, longitude: location!.longitude }
    : null;
  const pingTimestamp = location ? Date.parse(location.lastPingAt) : NaN;
  const locationFresh =
    Boolean(driverPoint) &&
    Number.isFinite(pingTimestamp) &&
    Date.now() - pingTimestamp < 90000;
  const targetPoint =
    status === "accepted"
      ? pickupPoint
      : status === "ongoing"
        ? dropoffPoint
        : null;
  const trailPoints = trail.filter(isValidPoint);
  const viewPoints =
    viewMode === "vehicle" && driverPoint
      ? [driverPoint, ...(targetPoint ? [targetPoint] : []), ...trailPoints.slice(-30)]
      : [
          ...(pickupPoint ? [pickupPoint] : []),
          ...(dropoffPoint ? [dropoffPoint] : []),
          ...trailPoints,
          ...(driverPoint ? [driverPoint] : []),
        ];

  if (viewPoints.length === 0) {
    return (
      <div className="grid h-[320px] place-items-center rounded-xl bg-[#edf1ea] p-6 text-center sm:h-[420px]">
        <p className="m-0 max-w-sm text-sm text-text-muted">
          Route coordinates are not available for this trip yet.
        </p>
      </div>
    );
  }

  const longitudes = viewPoints.map((point) => point.longitude);
  const mercatorYs = viewPoints.map((point) => mercatorY(point.latitude));
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minY = Math.min(...mercatorYs);
  const maxY = Math.max(...mercatorYs);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.001);
  const latitudeRange = Math.max(maxY - minY, 0.001);
  const project = (point: MapPoint): MapPoint => ({
    longitude:
      105 + ((point.longitude - minLongitude) / longitudeRange) * 790,
    latitude:
      65 + ((maxY - mercatorY(point.latitude)) / latitudeRange) * 330,
  });

  const projectedPickup = pickupPoint ? project(pickupPoint) : null;
  const projectedDropoff = dropoffPoint ? project(dropoffPoint) : null;
  const projectedDriver = driverPoint ? project(driverPoint) : null;
  const projectedTrail = trailPoints.map(project);
  const activeLine =
    driverPoint && targetPoint
      ? [project(driverPoint), project(targetPoint)]
      : projectedPickup && projectedDropoff
        ? [projectedPickup, projectedDropoff]
        : [];
  const trailDistanceKm =
    trail.slice(1).reduce(
      (total, point, index) => total + distanceMeters(trail[index], point),
      0
    ) / 1000;

  return (
    <div className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-[#edf1ea]">
      <div className="relative">
        <svg
          viewBox="0 0 1000 460"
          role="img"
          aria-label="Local live GPS view of the pickup, destination, vehicle, and recorded trip trail"
          className="block h-[320px] w-full sm:h-[420px]"
        >
          <defs>
            <pattern
              id="live-trip-grid"
              width="38"
              height="38"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 38 0 L 0 0 0 38"
                fill="none"
                stroke="#ffffff"
                strokeOpacity=".7"
                strokeWidth="1"
              />
            </pattern>
            <linearGradient id="live-trip-background" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#e9efe5" />
              <stop offset="100%" stopColor="#dce8df" />
            </linearGradient>
          </defs>
          <rect width="1000" height="460" fill="url(#live-trip-background)" />
          <rect width="1000" height="460" fill="url(#live-trip-grid)" />
          <path
            d="M 0 135 C 180 65, 260 225, 430 170 S 740 85, 1000 180 M 0 350 C 210 430, 390 260, 570 330 S 820 415, 1000 300"
            fill="none"
            stroke="#cbd8cc"
            strokeWidth="16"
            strokeLinecap="round"
            opacity=".7"
          />
          <path
            d="M 0 135 C 180 65, 260 225, 430 170 S 740 85, 1000 180 M 0 350 C 210 430, 390 260, 570 330 S 820 415, 1000 300"
            fill="none"
            stroke="#f8faf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="2 9"
          />
          {activeLine.length === 2 && (
            <polyline
              points={activeLine
                .map((point) => `${point.longitude},${point.latitude}`)
                .join(" ")}
              fill="none"
              stroke="#b87528"
              strokeWidth="5"
              strokeDasharray="9 12"
              strokeLinecap="round"
            />
          )}
          {projectedTrail.length > 1 && (
            <polyline
              points={projectedTrail
                .map((point) => `${point.longitude},${point.latitude}`)
                .join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {projectedPickup && markerLabel(projectedPickup, "P", "#587a50")}
          {projectedDropoff && markerLabel(projectedDropoff, "D", "#b87528")}
          {projectedDriver && (
            <g transform={`translate(${projectedDriver.longitude},${projectedDriver.latitude})`}>
              {locationFresh && (
                <circle
                  r="26"
                  fill="#2563eb"
                  fillOpacity=".14"
                  className="animate-pulse"
                />
              )}
              {markerLabel({ longitude: 0, latitude: 0 }, "V", "#2563eb")}
            </g>
          )}
          <text
            x="28"
            y="38"
            fill="#526454"
            fontSize="13"
            fontWeight="700"
            letterSpacing="2"
          >
            LIVE GPS TRACE
          </text>
          <text x="28" y="440" fill="#68786a" fontSize="11">
            Schematic view · not turn-by-turn navigation
          </text>
        </svg>
        <div className="absolute left-3 top-3 flex max-w-[46%] items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm">
          <span
            className={`size-2 shrink-0 rounded-full ${
              locationFresh
                ? "animate-pulse bg-emerald-500"
                : driverPoint
                  ? "bg-amber-500"
                  : "bg-slate-400"
            }`}
          />
          <span className="truncate">
            {locationFresh
              ? "Live vehicle location"
              : driverPoint
                ? "Last known location"
                : "Waiting for location"}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          {driverPoint && (
            <Button
              size="sm"
              variant="ghost"
              className="border-white/80 bg-white/95 shadow-sm"
              leftIcon={<LocateFixed className="size-4" />}
              onClick={() => setViewMode("vehicle")}
            >
              Follow vehicle
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="border-white/80 bg-white/95 shadow-sm"
            leftIcon={<Route className="size-4" />}
            onClick={() => setViewMode("trip")}
          >
            Show full route
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/80 bg-white/80 px-3 py-2.5 text-xs text-text-muted sm:px-4">
        <span>
          {trailDistanceKm > 0.05
            ? `${trailDistanceKm.toFixed(1)} km GPS trail recorded`
            : "GPS trail starts appearing as the vehicle moves"}
        </span>
        {location && (
          <span>Updated {new Date(location.lastPingAt).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
