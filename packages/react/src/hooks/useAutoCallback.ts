import type { AnyFunction } from "../types";
import { useCallback } from "./useCallback";
import { useRef } from "./useRef";

/**
 * 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백을 생성합니다.
 *
 * @param fn - 최신 상태를 참조할 함수
 * @returns 참조가 안정적인 콜백 함수
 */
export const useAutoCallback = <T extends AnyFunction>(fn: T): T => {
  // useRef로 최신 함수를 저장
  const fnRef = useRef(fn);

  // 매 렌더링마다 최신 함수로 업데이트
  fnRef.current = fn;

  // useCallback으로 안정적인 참조를 가진 래퍼 함수 생성
  // 이 함수는 항상 ref에 저장된 최신 함수를 호출
  const stableCallback = useCallback(
    ((...args: Parameters<T>) => {
      return fnRef.current(...args);
    }) as T,
    [],
  );

  return stableCallback;
};
