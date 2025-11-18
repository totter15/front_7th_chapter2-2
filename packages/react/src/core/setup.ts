import { context } from "./context";
import { VNode } from "./types";
import { removeInstance, setDomProps } from "./dom";
import { cleanupUnusedHooks } from "./hooks";
import { render } from "./render";
import { TEXT_ELEMENT, Fragment } from "./constants";

const createDome = (vNode: VNode) => {
  let node: HTMLElement | Text | DocumentFragment | null = null;
  const { children, ...restProps } = vNode.props;

  // 노드 생성
  // 텍스트 노드 처리
  if (vNode.type === TEXT_ELEMENT) {
    node = document.createTextNode(vNode.props.nodeValue as string);
    return node;
  }

  // 함수 컴포넌트 처리
  if (typeof vNode.type === "function") {
    const renderedVNode = vNode.type(vNode.props);
    // null을 반환할 수 있으므로 체크합니다
    if (renderedVNode === null) {
      return null;
    }
    // 반환된 VNode를 재귀적으로 DOM으로 변환합니다
    return createDome(renderedVNode);
  }

  // Fragment 처리
  if (vNode.type === Fragment) {
    node = document.createDocumentFragment();

    // 자식 노드 추가
    if (children && children.length > 0) {
      children.forEach((c) => {
        const child = createDome(c);
        if (child) {
          node?.appendChild(child);
        }
      });
    }
    return node;
  }

  // HTML 요소 처리
  if (typeof vNode.type === "string") {
    node = document.createElement(vNode.type as string);

    // 자식 노드 추가
    if (children && children.length > 0) {
      children.forEach((c) => {
        const child = createDome(c);
        if (child) {
          node?.appendChild(child);
        }
      });
    }

    // 속성 추가
    setDomProps(node as HTMLElement, restProps);

    return node;
  }
};

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
  if (container.firstChild) {
    container.removeChild(container.firstChild as Node);
  }
  // 3. 루트 컨텍스트와 훅 컨텍스트를 리셋합니다.

  // 4. 첫 렌더링을 실행합니다.
  const node = createDome(rootNode);
  if (node) container.appendChild(node);
};
