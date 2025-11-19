import { context } from "./context";
import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  // 1. 훅 컨텍스트를 초기화합니다.
  context.hooks.clear();

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  // 루트 경로는 "0"을 사용합니다 (componentStack이 비어있으므로 currentPath 사용 불가)
  const updatedInstance = reconcile(
    context.root.container as HTMLElement,
    context.root.instance,
    context.root.node,
    "0", // 루트 경로
  );

  // 3. 반환된 인스턴스를 context.root에 저장합니다.
  // container와 node는 변경하지 않습니다 (이미 setup에서 설정됨)
  context.root.instance = updatedInstance;

  // 4. 사용되지 않은 훅들을 정리(cleanupUnusedHooks)합니다.
  cleanupUnusedHooks();
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
