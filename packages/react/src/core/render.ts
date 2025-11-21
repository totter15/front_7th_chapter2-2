import { context } from "./context";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue } from "../utils";
import { HookTypes } from "./constants";
import type { EffectHook } from "./types";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
/**
 * 예약된 이펙트들을 실행합니다.
 * 렌더링이 끝난 후 비동기로 실행됩니다.
 */
const executeEffects = (): void => {
  const effectsToRun = [...context.effects.queue];
  context.effects.queue = [];

  effectsToRun.forEach(({ path, cursor, effect }) => {
    // path에 대한 훅 배열 가져오기
    const hooks = context.hooks.state.get(path);
    if (!hooks) return;

    // 현재 커서에 해당하는 effect hook 가져오기
    const hook = hooks[cursor] as EffectHook | undefined;
    if (!hook || hook.kind !== HookTypes.EFFECT) return;

    // 이전 클린업 함수 실행
    if (hook.cleanup) hook.cleanup();

    // effect함수 실행후 return 값으로 new cleanup 함수 생성
    const cleanup = effect();

    // 클린업 함수 저장
    const newHooks = [...hooks];
    const updatedHook: EffectHook = {
      ...hook,
      cleanup: cleanup || null,
    };
    newHooks[cursor] = updatedHook;
    context.hooks.state.set(path, newHooks);
  });
};

export const render = (): void => {
  // 1. 훅 컨텍스트를 초기화합니다.
  context.hooks.cursor.clear();
  context.hooks.visited.clear();
  context.hooks.componentStack = [];

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  context.root.instance = reconcile(
    context.root.container as HTMLElement,
    context.root.instance,
    context.root.node,
    "0", // 루트 경로
  );

  // 3. 예약된 이펙트들을 실행합니다 (렌더링 후 비동기)
  if (context.effects.queue.length > 0) queueMicrotask(executeEffects);

  cleanupUnusedHooks();
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
