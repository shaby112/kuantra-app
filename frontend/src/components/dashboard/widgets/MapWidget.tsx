import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { WidgetConfig } from "@/types/dashboard";

// Fix for default marker icons in Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapWidgetProps {
    config: WidgetConfig;
    className?: string;
}

export function MapWidget({ config, className }: MapWidgetProps) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize map
        if (!mapRef.current) {
            mapRef.current = L.map(containerRef.current, {
                center: [40.7128, -74.006], // Default to New York
                zoom: 4,
                zoomControl: true,
                scrollWheelZoom: true,
            });

            // Add tile layer (OpenStreetMap)
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(mapRef.current);
        }

        // Clear existing markers
        mapRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                mapRef.current?.removeLayer(layer);
            }
        });

        // Add markers from data
        const mapData = config.mapData || [];
        if (mapData.length > 0) {
            const bounds: L.LatLngTuple[] = [];

            mapData.forEach((point) => {
                if (point.lat && point.lng && mapRef.current) {
                    const marker = L.marker([point.lat, point.lng]).addTo(mapRef.current);

                    // Add popup with data
                    const popupContent = `
            <div class="text-sm">
              <strong class="text-foreground">${point.region}</strong><br/>
              <span class="text-muted-foreground">Value: ${point.value}</span>
            </div>
          `;
                    marker.bindPopup(popupContent);

                    bounds.push([point.lat, point.lng]);
                }
            });

            // Fit map to show all markers
            if (bounds.length > 0 && mapRef.current) {
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
        }

        // Cleanup
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [config.mapData]);

    // Handle theme changes
    useEffect(() => {
        if (!mapRef.current) return;

        // Force map to recalculate size when container changes
        setTimeout(() => {
            mapRef.current?.invalidateSize();
        }, 100);
    }, [className]);

    return (
        <div className={cn("h-full w-full relative rounded-lg overflow-hidden", className)} style={{ minHeight: '100px' }}>
            <div ref={containerRef} className="h-full w-full z-0" style={{ height: '100%', width: '100%' }} />
            {(!config.mapData || config.mapData.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 pointer-events-none">
                    <div className="text-center text-muted-foreground">
                        <p className="text-sm font-medium">No location data</p>
                        <p className="text-xs">Configure a data source with lat/lng columns</p>
                    </div>
                </div>
            )}
        </div>
    );
}
