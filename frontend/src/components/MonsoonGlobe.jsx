import { useEffect, useRef } from "react";
import Globe from "react-globe.gl";

const MONSOON_ARCS = [
  {
    startLat: 10,
    startLng: 55,
    endLat: 20,
    endLng: 72,
    color: "#22d3ee",
  },
  {
    startLat: 8,
    startLng: 58,
    endLat: 18,
    endLng: 76,
    color: "#38bdf8",
  },
  {
    startLat: 7,
    startLng: 72,
    endLat: 23,
    endLng: 78,
    color: "#34d399",
  },
  {
    startLat: 5,
    startLng: 78,
    endLat: 18,
    endLng: 84,
    color: "#22d3ee",
  },
  {
    startLat: 4,
    startLng: 84,
    endLat: 22,
    endLng: 88,
    color: "#38bdf8",
  },
  {
    startLat: 2,
    startLng: 90,
    endLat: 23,
    endLng: 88,
    color: "#34d399",
  },
];

const MONSOON_POINTS = [
  {
    lat: 19.07,
    lng: 72.87,
    name: "Mumbai",
    value: "West Coast",
  },
  {
    lat: 23.02,
    lng: 72.57,
    name: "Ahmedabad",
    value: "Gujarat",
  },
  {
    lat: 25.32,
    lng: 82.97,
    name: "Varanasi",
    value: "North India",
  },
  {
    lat: 28.61,
    lng: 77.21,
    name: "Delhi",
    value: "North India",
  },
  {
    lat: 13.08,
    lng: 80.27,
    name: "Chennai",
    value: "East Coast",
  },
  {
    lat: 22.57,
    lng: 88.36,
    name: "Kolkata",
    value: "Bay of Bengal",
  },
  {
    lat: 25.58,
    lng: 91.89,
    name: "Meghalaya",
    value: "Orographic",
  },
];

export default function MonsoonGlobe() {
  const globeRef = useRef();

  useEffect(() => {
    if (!globeRef.current) return;

    const controls = globeRef.current.controls();

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    controls.enableZoom = false;

    globeRef.current.pointOfView(
      {
        lat: 20,
        lng: 78,
        altitude: 2.1,
      },
      1200
    );
  }, []);

  return (
    <div className="monsoon-globe-wrapper">

      <Globe
        ref={globeRef}

        width={620}
        height={620}

        backgroundColor="rgba(0,0,0,0)"

        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"

        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"

        atmosphereColor="#22d3ee"
        atmosphereAltitude={0.18}

        showGraticules={true}

        arcsData={MONSOON_ARCS}

        arcStartLat={(d) => d.startLat}
        arcStartLng={(d) => d.startLng}

        arcEndLat={(d) => d.endLat}
        arcEndLng={(d) => d.endLng}

        arcColor={(d) => d.color}

        arcAltitudeAutoScale={0.35}

        arcStroke={0.6}

        arcDashLength={0.35}
        arcDashGap={1.2}
        arcDashInitialGap={() => Math.random()}

        arcDashAnimateTime={2200}

        arcsTransitionDuration={800}

        pointsData={MONSOON_POINTS}

        pointLat="lat"
        pointLng="lng"

        pointColor={() => "#22d3ee"}

        pointAltitude={0.025}

        pointRadius={0.18}

        pointResolution={12}

        pointsMerge={false}

        pointLabel={(d) => `
          <div style="
            padding:8px 12px;
            background:#020617;
            border:1px solid rgba(34,211,238,.35);
            border-radius:8px;
            color:white;
            font-family:Arial;
          ">
            <strong>${d.name}</strong>
            <br/>
            <span style="color:#64748b">
              ${d.value}
            </span>
          </div>
        `}

        ringsData={MONSOON_POINTS}

        ringLat="lat"
        ringLng="lng"

        ringColor={() => "#22d3ee"}

        ringMaxRadius={3}

        ringPropagationSpeed={1.8}

        ringRepeatPeriod={1800}

      />

      {/* Atmospheric overlay */}

      <div className="globe-overlay">
        <div className="globe-status">
          <span className="status-dot" />

          LIVE MONSOON SYSTEM
        </div>

        <div className="globe-location">
          INDIA
        </div>

        <div className="globe-caption">
          Arabian Sea
          <span>→</span>
          Indian Subcontinent
          <span>→</span>
          Bay of Bengal
        </div>
      </div>

    </div>
  );
}