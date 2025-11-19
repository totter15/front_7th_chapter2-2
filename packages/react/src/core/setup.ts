import { context } from "./context";
import { VNode } from "./types";
import { removeInstance, setDomProps } from "./dom";
import { cleanupUnusedHooks } from "./hooks";
import { render } from "./render";

/**
 * Mini-React 애플리케이션의 루트를 설정하고 첫 렌더링을 시작합니다.
 *
 * @param rootNode - 렌더링할 최상위 VNode
 * @param container - VNode가 렌더링될 DOM 컨테이너
 */
export const setup = (rootNode: VNode | null, container: HTMLElement): void => {
  // 여기를 구현하세요.
  // 1. 컨테이너 유효성을 검사합니다.
  if (!container) throw new Error("Container is required");
  if (rootNode === null) throw new Error("Root node is required");

  // 2. 이전 렌더링 내용을 정리하고 컨테이너를 비웁니다.
  if (context.root.instance) {
    removeInstance(container, context.root.instance);
  }
  // 컨테이너를 완전히 비웁니다 (removeInstance로 제거되지 않은 노드들)
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  cleanupUnusedHooks();

  // 3. 루트 컨텍스트와 훅 컨텍스트를 리셋합니다.
  context.root.reset({ container, node: rootNode });
  context.hooks.clear();

  // 4. 첫 렌더링을 실행합니다.
  render();
};
