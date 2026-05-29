"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * 封装 localStorage 读写的 try/catch 模式。
 * SSR / private mode 下安全降级到 defaultValue。
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  opts?: {
    /** 自定义反序列化；默认 JSON.parse */
    parse?: (raw: string) => T | null;
    /** 自定义序列化；默认 JSON.stringify */
    serialize?: (value: T) => string;
    /** 跳过首次 mount 时的读取 */
    skipInitialRead?: boolean;
    /** 跳过首次 mount 时的写入（避免覆盖已有值） */
    skipFirstWrite?: boolean;
  },
): [T, (value: T | ((prev: T) => T)) => void] {
  const parse = useMemo(
    () => opts?.parse ?? ((raw: string) => JSON.parse(raw) as T),
    [opts?.parse],
  );
  const serialize = useMemo(
    () => opts?.serialize ?? ((v: T) => JSON.stringify(v)),
    [opts?.serialize],
  );
  const skipFirstWrite = useRef(opts?.skipFirstWrite ?? false);

  const [value, setValue] = useState<T>(() => {
    if (opts?.skipInitialRead) return defaultValue;
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const parsed = parse(raw);
        if (parsed !== null) return parsed;
      }
    } catch {
      /* private mode */
    }
    return defaultValue;
  });

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        if (skipFirstWrite.current) {
          skipFirstWrite.current = false;
          return resolved;
        }
        try {
          localStorage.setItem(key, serialize(resolved));
        } catch {
          /* private mode */
        }
        return resolved;
      });
    },
    [key, serialize],
  );

  return [value, setAndPersist];
}
