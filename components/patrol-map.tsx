'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import 'leaflet/dist/leaflet.css';
import {
  Facility,
  Point,
  Region,
  FieldReport,
  Candidate,
  gapColor,
  valid,
  number,
} from '@/lib/patrol';
import { Crosshair, LocateFixed } from 'lucide-react';
type Props = {
  candidates: Candidate[];
  onCandidate: (c: Candidate) => void;
  rows: Facility[];
  reports: FieldReport[];
  overview: Region[] | null;
  onCity: (city: string) => void;
  onSelect: (r: Facility) => void;
  onPoint: (p: Point) => void;
  focus?: Point & { zoom: number; stamp: number };
  point: Point | null;
  radius: number;
  onError: (s: string) => void;
};
export default function PatrolMap({
  candidates,
  onCandidate,
  rows,
  reports,
  overview,
  onCity,
  onSelect,
  onPoint,
  focus,
  point,
  radius,
  onError,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    overlay = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false),
    [tileError, setTileError] = useState(false);
  const latest = useRef({ onSelect, onPoint, onCity, onError, onCandidate });
  useEffect(() => {
    latest.current = { onSelect, onPoint, onCity, onError, onCandidate };
  }, [onSelect, onPoint, onCity, onError, onCandidate]);
  const reduce = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      zoomControl: false,
      preferCanvas: true,
      minZoom: 7,
      maxZoom: 19,
    }).setView([37.42, 127.1267], 13);
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .on('tileload', () => setTileError(false))
      .addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    overlay.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) =>
      latest.current.onPoint({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        label: '지도에서 선택한 지점',
      }),
    );
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    setReady(true);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !layer.current) return;
    const m = map.current,
      g = layer.current;
    g.clearLayers();
    if (overview) {
      for (const city of overview) {
        if (city.name === '지역 미확인') continue;
        const el = document.createElement('span');
        el.textContent = city.name;
        const marker = L.marker(city.center, {
          icon: L.divIcon({
            className: 'region-pin',
            html: el.outerHTML,
            iconSize: [82, 34],
          }),
          title: city.name + ' 자료 열기',
        }).addTo(g);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          latest.current.onCity(city.name);
        });
      }
      return;
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const indexes = (['cctv', 'lights'] as const).map((kind) => ({
      kind,
      index: new Supercluster({
        radius: kind === 'lights' ? 38 : 48,
        maxZoom: 18,
      }).load(
        rows
          .filter((r) => r.kind === kind && valid(r))
          .map((r) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [r.lng!, r.lat!] },
            properties: { id: r.id },
          })),
      ),
    }));
    const paint = () => {
      g.clearLayers();
      const b = m.getBounds(),
        bbox: [number, number, number, number] = [
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ];
      for (const { kind, index } of indexes) {
        for (const f of index.getClusters(bbox, Math.floor(m.getZoom()))) {
          const [lng, lat] = f.geometry.coordinates,
            p = f.properties as {
              cluster?: boolean;
              point_count: number;
              cluster_id: number;
              id: string;
            };
          if (p.cluster) {
            const size =
              p.point_count > 1000 ? 48 : p.point_count > 100 ? 40 : 32;
            const marker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: `facility-cluster ${kind}`,
                html: `<span>${number(p.point_count)}</span>`,
                iconSize: [size, size],
              }),
              title: `${kind === 'cctv' ? 'CCTV' : '보안등'} ${number(p.point_count)}건, 확대`,
            }).addTo(g);
            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              m.flyTo(
                [lat, lng],
                Math.min(19, index.getClusterExpansionZoom(p.cluster_id)),
                { duration: reduce() ? 0 : 0.45 },
              );
            });
          } else {
            const r = byId.get(p.id);
            if (!r) continue;
            const marker = L.circleMarker([lat, lng], {
              radius: kind === 'lights' ? 4 : 6,
              weight: 1.5,
              color: '#fff',
              fillColor: kind === 'lights' ? '#e39c23' : '#4368ed',
              fillOpacity: 0.92,
            }).addTo(g);
            const text = document.createElement('span');
            text.textContent = `${kind === 'lights' ? '보안등' : r.purpose} · ${r.address}`;
            marker.bindTooltip(text);
            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              latest.current.onSelect(r);
            });
          }
        }
      }
      for (const report of reports) {
        const marker = L.circleMarker([report.lat, report.lng], {
          radius: 9,
          color: '#fff',
          weight: 3,
          fillColor:
            report.status === '조치 확인'
              ? '#029c81'
              : report.status === '현장 확인'
                ? '#dc871d'
                : '#ea6974',
          fillOpacity: 1,
        }).addTo(g);
        const text = document.createElement('span');
        text.textContent = `${report.moderation_status === 'pending' ? '승인 대기 · ' : ''}${report.status} · ${report.title}`;
        marker.bindTooltip(text);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          latest.current.onPoint({
            lat: report.lat,
            lng: report.lng,
            label: report.title,
          });
        });
      }
    };
    paint();
    m.on('moveend', paint);
    return () => {
      m.off('moveend', paint);
    };
  }, [rows, reports, overview, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    const pane = m.getPane('inspection') || m.createPane('inspection');
    pane.style.zIndex = '350';
    const group = L.layerGroup().addTo(m);
    const paint = () => {
      group.clearLayers();
      if (m.getZoom() < 11) return;
      const bounds = m.getBounds();
      for (const c of candidates) {
        const [w, s, e, n] = c.bounds;
        if (
          e < bounds.getWest() ||
          w > bounds.getEast() ||
          n < bounds.getSouth() ||
          s > bounds.getNorth()
        )
          continue;
        const rect = L.rectangle(
          [
            [s, w],
            [n, e],
          ],
          {
            pane: 'inspection',
            color: gapColor(c.score),
            weight: 0.7,
            fillColor: gapColor(c.score),
            fillOpacity: 0.3,
            bubblingMouseEvents: false,
          },
        ).addTo(group);
        const tip = document.createElement('span');
        tip.textContent = `시설 점검 참고 ${c.score}점 · 구획 CCTV ${c.cctv} / 보안등 ${c.lights}개 좌표`;
        rect.bindTooltip(tip);
        rect.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          latest.current.onCandidate(c);
        });
      }
    };
    paint();
    m.on('moveend', paint);
    return () => {
      m.off('moveend', paint);
      group.remove();
    };
  }, [candidates, ready]);
  useEffect(() => {
    if (ready && focus)
      map.current?.flyTo([focus.lat, focus.lng], focus.zoom, {
        duration: reduce() ? 0 : 0.6,
      });
  }, [focus, ready]);
  useEffect(() => {
    const g = overlay.current;
    if (!ready || !g) return;
    g.clearLayers();
    if (point) {
      L.circle([point.lat, point.lng], {
        radius,
        color: '#0d968e',
        weight: 2,
        dashArray: '5 6',
        fillColor: '#29b9a4',
        fillOpacity: 0.11,
        interactive: false,
      }).addTo(g);
      L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#063d55',
        fillOpacity: 1,
        interactive: false,
      }).addTo(g);
    }
  }, [point, radius, ready]);
  return (
    <>
      <div
        className="map-canvas"
        ref={host}
        aria-label="경기도 CCTV와 보안등 지도. 왼쪽 시설 목록으로도 선택할 수 있습니다."
      />
      <div className="map-buttons">
        <button
          title="지도 중심 주변 확인"
          onClick={() => {
            const c = map.current?.getCenter();
            if (c) onPoint({ lat: c.lat, lng: c.lng, label: '지도 중심 지점' });
          }}
        >
          <Crosshair size={19} />
          <span>이곳 주변 확인</span>
        </button>
        <button
          title="내 위치로 이동"
          aria-label="내 위치로 이동"
          onClick={() => {
            if (!navigator.geolocation) {
              onError('현재 기기에서 위치 확인을 지원하지 않습니다.');
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                map.current?.flyTo([p.coords.latitude, p.coords.longitude], 16);
                onPoint({
                  lat: p.coords.latitude,
                  lng: p.coords.longitude,
                  label: '현재 위치',
                });
              },
              () =>
                onError(
                  '위치를 확인할 수 없습니다. 위치 권한을 확인하거나 지도에서 선택해 주세요.',
                ),
              { timeout: 15000, maximumAge: 60000 },
            );
          }}
        >
          <LocateFixed size={19} />
        </button>
      </div>
      {tileError && (
        <div className="map-error">
          배경지도 연결이 지연됩니다. 시설 목록은 계속 이용할 수 있습니다.
        </div>
      )}
    </>
  );
}
