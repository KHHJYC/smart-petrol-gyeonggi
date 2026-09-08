'use client';
import { useEffect, useRef } from 'react';
import type { RegionData } from '@/lib/patrol';
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Registry = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function usePublicMapTool(data: RegionData, city: string) {
  const latest = useRef({ data, city });
  useEffect(() => {
    latest.current = { data, city };
  }, [data, city]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'search_public_facilities',
            title: '현재 시군 안전시설 검색',
            description:
              '화면에서 선택한 시군의 공개 CCTV·보안등 자료를 검색합니다. 현장 기록 작성이나 범죄위험 판단은 하지 않습니다.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', minLength: 1, maxLength: 100 },
              },
              required: ['query'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                !('query' in input) ||
                typeof input.query !== 'string' ||
                !input.query.trim() ||
                input.query.length > 100
              )
                throw Error('1~100자 검색어가 필요합니다.');
              const { data: rows, city: currentCity } = latest.current;
              const words = input.query.trim().toLowerCase().split(/\s+/);
              const results = [...rows.cctv, ...rows.lights].filter((r) =>
                words.every((w) =>
                  (r.address + ' ' + r.name + ' ' + r.agency)
                    .toLowerCase()
                    .includes(w),
                ),
              );
              return {
                city: currentCity,
                total: results.length,
                results: results
                  .slice(0, 20)
                  .map((r) => ({
                    id: r.id,
                    kind: r.kind,
                    address: r.address,
                    lat: r.lat,
                    lng: r.lng,
                    date: r.date,
                  })),
                interpretation:
                  '등록된 시설 위치이며 실제 밝기나 안전도는 아닙니다.',
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Experimental support is optional. */
    }
    return () => lifecycle.abort();
  }, []);
}
