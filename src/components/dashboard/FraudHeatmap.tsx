import { motion } from "framer-motion";
import { useState } from "react";

interface Hotspot {
  id: string;
  city: string;
  country: string;
  x: number;
  y: number;
  intensity: number; // 0-100
  incidents: number;
}

const hotspots: Hotspot[] = [
  { id: "1", city: "Mumbai", country: "India", x: 63.5, y: 52, intensity: 95, incidents: 142 },
  { id: "2", city: "Delhi", country: "India", x: 63, y: 42, intensity: 82, incidents: 98 },
  { id: "3", city: "Lagos", country: "Nigeria", x: 44.5, y: 55, intensity: 78, incidents: 87 },
  { id: "4", city: "London", country: "UK", x: 47, y: 30, intensity: 65, incidents: 64 },
  { id: "5", city: "New York", country: "USA", x: 26, y: 37, intensity: 72, incidents: 76 },
  { id: "6", city: "Singapore", country: "Singapore", x: 73, y: 57, intensity: 58, incidents: 52 },
  { id: "7", city: "Dubai", country: "UAE", x: 58, y: 44, intensity: 61, incidents: 55 },
  { id: "8", city: "São Paulo", country: "Brazil", x: 31, y: 66, intensity: 54, incidents: 48 },
  { id: "9", city: "Shanghai", country: "China", x: 78, y: 40, intensity: 68, incidents: 71 },
  { id: "10", city: "Moscow", country: "Russia", x: 57, y: 27, intensity: 45, incidents: 38 },
  { id: "11", city: "Bengaluru", country: "India", x: 64, y: 56, intensity: 70, incidents: 67 },
  { id: "12", city: "Johannesburg", country: "South Africa", x: 52, y: 72, intensity: 42, incidents: 34 },
];

const intensityColor = (intensity: number) => {
  if (intensity >= 80) return "hsl(0, 72%, 51%)";
  if (intensity >= 60) return "hsl(38, 92%, 50%)";
  if (intensity >= 40) return "hsl(48, 96%, 53%)";
  return "hsl(142, 72%, 45%)";
};

export default function FraudHeatmap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Global Fraud Heatmap</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Medium</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Critical</span>
        </div>
      </div>

      <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-secondary/30">
        {/* Simplified world map using SVG paths */}
        <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[10, 20, 30, 40].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="hsl(220, 16%, 14%)" strokeWidth="0.15" />
          ))}
          {[20, 40, 60, 80].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="50" stroke="hsl(220, 16%, 14%)" strokeWidth="0.15" />
          ))}

          {/* Continent outlines (simplified) */}
          {/* North America */}
          <path d="M5,10 Q15,8 25,12 L30,18 Q28,25 25,30 L20,35 Q15,38 12,35 L8,28 Q4,20 5,10Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* South America */}
          <path d="M25,35 Q30,38 32,42 L33,50 Q30,55 28,58 L26,62 Q24,68 22,72 L20,74 Q18,72 19,65 L20,55 Q22,45 25,35Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* Europe */}
          <path d="M42,10 Q48,8 52,12 L54,18 Q52,22 50,25 L48,28 Q46,30 44,28 L42,24 Q40,18 42,10Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* Africa */}
          <path d="M42,30 Q48,28 54,32 L56,40 Q55,50 52,58 L50,65 Q48,70 45,72 L42,70 Q40,62 40,52 L40,40 Q40,34 42,30Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* Asia */}
          <path d="M54,8 Q65,6 78,10 L85,15 Q88,22 85,30 L80,35 Q75,40 70,42 L65,45 Q60,48 56,45 L54,38 Q52,28 54,18 L54,8Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* India subcontinent */}
          <path d="M60,38 Q64,36 68,40 L66,50 Q64,56 62,58 L60,55 Q58,48 60,38Z"
            fill="hsl(220, 16%, 13%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />
          {/* Australia */}
          <path d="M76,58 Q82,56 88,60 L90,65 Q88,70 84,72 L78,70 Q74,66 76,58Z"
            fill="hsl(220, 16%, 12%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.2" />

          {/* Hotspots */}
          {hotspots.map((spot) => {
            const color = intensityColor(spot.intensity);
            const r = 0.6 + (spot.intensity / 100) * 0.8;
            const isHovered = hovered === spot.id;
            return (
              <g key={spot.id}
                onMouseEnter={() => setHovered(spot.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                {/* Glow ring */}
                <circle cx={spot.x / 100 * 100} cy={spot.y / 100 * 50} r={r * 3} fill={color} opacity={0.08}>
                  <animate attributeName="r" values={`${r * 2.5};${r * 3.5};${r * 2.5}`} dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx={spot.x / 100 * 100} cy={spot.y / 100 * 50} r={r * 1.8} fill={color} opacity={0.15}>
                  <animate attributeName="opacity" values="0.15;0.25;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Core dot */}
                <circle cx={spot.x / 100 * 100} cy={spot.y / 100 * 50} r={isHovered ? r * 1.4 : r} fill={color} opacity={0.9}
                  style={{ transition: "r 0.2s" }}
                />

                {/* Tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={spot.x / 100 * 100 - 8} y={spot.y / 100 * 50 - 6}
                      width="16" height="5" rx="0.5"
                      fill="hsl(220, 18%, 8%)" stroke="hsl(220, 16%, 18%)" strokeWidth="0.15"
                    />
                    <text x={spot.x / 100 * 100} y={spot.y / 100 * 50 - 3.5}
                      textAnchor="middle" fill="hsl(0, 0%, 95%)" fontSize="1.4" fontWeight="600">
                      {spot.city}
                    </text>
                    <text x={spot.x / 100 * 100} y={spot.y / 100 * 50 - 1.8}
                      textAnchor="middle" fill="hsl(220, 10%, 50%)" fontSize="1" fontFamily="monospace">
                      {spot.incidents} incidents
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Top hotspots list */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
        {hotspots.slice(0, 4).map((spot) => (
          <div key={spot.id} className="p-2 rounded-lg bg-secondary/50 text-center">
            <p className="text-[10px] text-muted-foreground">{spot.city}</p>
            <p className="text-xs font-mono font-bold" style={{ color: intensityColor(spot.intensity) }}>
              {spot.incidents}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
