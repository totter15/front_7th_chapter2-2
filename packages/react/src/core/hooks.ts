import { shallowEquals } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = (visitedPaths?: Set<string>) => {
  // state에 저장된 모든 경로 가져오기
  const allPaths = Array.from(context.hooks.state.keys());
  const visited = visitedPaths || context.hooks.visited;

  // 이번 렌더링에서 방문하지 않은 경로는 언마운트된 컴포넌트
  for (const path of allPaths) {
    if (!visited.has(path)) {
      // 언마운트된 컴포넌트의 모든 이펙트 클린업 함수 실행
      const hooks = context.hooks.state.get(path);
      if (hooks) {
        hooks.forEach((hook) => {
          if (hook && typeof hook === "object" && "kind" in hook && hook.kind === HookTypes.EFFECT) {
            const effectHook = hook as EffectHook;
            if (effectHook.cleanup) {
              effectHook.cleanup();
            }
          }
        });
      }

      // 해당 경로의 state 삭제
      context.hooks.state.delete(path);
      // cursor도 삭제
      context.hooks.cursor.delete(path);
    }
  }
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 여기를 구현하세요.

  // 컴포넌트 외부에서 호출시
  // 1. 현재 컴포넌트의 훅 커서와 상태 배열을 가져옵니다.
  // 실행중인 hook의 index
  // hook 상태 배열
  const currentCursor = context.hooks.currentCursor;
  const currentHooks = context.hooks.currentHooks;
  const currentPath = context.hooks.currentPath;

  // 2. 첫 렌더링이라면 초기값으로 상태를 설정합니다.
  const isFirstRender = currentCursor >= currentHooks.length;

  if (isFirstRender) {
    // initialValue가 함수면 실행, 아니면 그대로 사용
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    context.hooks.state.set(currentPath, [...currentHooks, value]);
  }

  // 3. 상태 변경 함수(setter)를 생성합니다.
  //    - 새 값이 이전 값과 같으면(Object.is) 재렌더링을 건너뜁니다.
  //    - 값이 다르면 상태를 업데이트하고 재렌더링을 예약(enqueueRender)합니다.
  // 4. 훅 커서를 증가시키고 [상태, setter]를 반환합니다.
  const setState = (nextValue: T | ((prev: T) => T)) => {
    const hooks = context.hooks.state.get(currentPath) || [];
    const prevValue = hooks[currentCursor];

    // 함수형 업데이트 처리
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(prevValue) : nextValue;

    // Object.is로 값 비교 (React와 동일)
    if (Object.is(prevValue, newValue)) {
      return;
    }

    const newState = [...hooks];
    newState[currentCursor] = newValue;

    context.hooks.state.set(currentPath, newState);
    enqueueRender();
  };

  const state = context.hooks.state.get(currentPath)?.[currentCursor];
  context.hooks.cursor.set(currentPath, currentCursor + 1);
  return [state as T, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  const currentCursor = context.hooks.currentCursor;
  const currentHooks = context.hooks.currentHooks;
  const currentPath = context.hooks.currentPath;

  // 1. 이전 훅의 의존성 배열과 현재 의존성 배열을 비교(shallowEquals)합니다.
  const isFirstRender = currentCursor >= currentHooks.length;
  let prevDeps: unknown[] | null = null;

  if (!isFirstRender) {
    // 이전 hook 배열
    const prevHook = currentHooks[currentCursor] as EffectHook | undefined;
    // 이전 hook 배열이 존재하고 이게 effect hook이면 이전 deps저장
    if (prevHook && prevHook.kind === HookTypes.EFFECT) {
      prevDeps = prevHook.deps;
    }
  }

  // 의존성 배열 비교 (첫 렌더링이거나 의존성이 변경된 경우 실행)
  // 첫 렌더링이거나 이전 deps와 현재 deps가 다르면 실행
  const depsChanged = isFirstRender || !shallowEquals(prevDeps, deps);

  // 2. 의존성이 변경되었거나 첫 렌더링일 경우, 이펙트 실행을 예약합니다.
  if (depsChanged) {
    context.effects.queue.push({
      path: currentPath,
      cursor: currentCursor,
      effect,
    });
  }

  // 3. 이펙트 훅 상태 저장 (의존성, effect 함수, 클린업은 나중에 설정)
  const effectHook: EffectHook = {
    kind: HookTypes.EFFECT,
    deps: deps ?? null,
    cleanup: null,
    effect,
  };

  // 이전 클린업 함수가 있으면 저장 (실행은 이펙트 실행 시점에)
  if (!isFirstRender) {
    const prevHook = currentHooks[currentCursor] as EffectHook | undefined;
    if (prevHook && prevHook.kind === HookTypes.EFFECT && prevHook.cleanup) {
      effectHook.cleanup = prevHook.cleanup;
    }
  }

  // 상태 업데이트
  if (isFirstRender) {
    context.hooks.state.set(currentPath, [...currentHooks, effectHook]);
  } else {
    const newHooks = [...currentHooks];
    newHooks[currentCursor] = effectHook;
    context.hooks.state.set(currentPath, newHooks);
  }

  // 4. 훅 커서 증가
  context.hooks.cursor.set(currentPath, currentCursor + 1);
};
