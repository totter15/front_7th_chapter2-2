/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeType, NodeTypes } from "./constants";
import { Instance, VNode } from "./types";
import { TEXT_ELEMENT, Fragment } from "./constants";

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  Object.keys(props).forEach((key) => {
    if (key === "children") return;
    if (dom.nodeType === Node.TEXT_NODE) return;
    if (!dom) return;

    const value = props[key];

    // 이벤트 핸들러 처리
    if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      (dom as HTMLElement).addEventListener(eventName, value as EventListener);
      return;
    }

    // 스타일 객체 처리
    if (key === "style" && typeof value === "object") {
      Object.assign((dom as HTMLElement).style, value);
      return;
    }

    // className 속성 처리
    if (key === "className") {
      (dom as HTMLElement).setAttribute("class", value as string);
      return;
    }

    // 일반 HTML 속성은 setAttribute로 설정
    // 단, boolean 값은 속성의 존재 여부로 처리
    if (typeof value === "boolean") {
      if (value) {
        (dom as HTMLElement).setAttribute(key, "");
      } else {
        (dom as HTMLElement).removeAttribute(key);
      }
      return;
    }

    (dom as HTMLElement)?.setAttribute(key, String(value));
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  // 이벤트 핸들러 처리: 변경되거나 제거된 이벤트 핸들러 제거
  Object.keys(prevProps).forEach((key) => {
    if (key === "children") return;

    const prevValue = prevProps[key];
    const nextValue = nextProps[key];

    // 이벤트 핸들러인 경우
    if (key.startsWith("on") && typeof prevValue === "function") {
      const eventName = key.slice(2).toLowerCase();

      // 이벤트 핸들러가 제거되었거나 변경된 경우
      if (nextValue === undefined || nextValue !== prevValue) {
        dom.removeEventListener(eventName, prevValue as EventListener);
      }
    }
  });

  // nextProps에 없는 일반 속성 제거
  Object.keys(prevProps).forEach((key) => {
    if (key === "children") return;
    if (key.startsWith("on")) return; // 이벤트 핸들러는 위에서 처리됨

    if (nextProps[key] === undefined) {
      // className은 "class" 속성으로 제거
      if (key === "className") {
        dom.removeAttribute("class");
      } else if (key === "style" && typeof prevProps[key] === "object") {
        // 스타일 객체의 경우 모든 속성 제거
        Object.keys(prevProps[key] || {}).forEach((styleKey) => {
          (dom as HTMLElement).style.removeProperty(styleKey);
        });
      } else {
        dom.removeAttribute(key);
      }
    }
  });

  // 새 속성 설정 (변경된 속성 포함)
  setDomProps(dom, nextProps);
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  return instance?.children.map((child) => child?.dom as HTMLElement | Text) ?? [];
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  return instance?.dom as HTMLElement | Text | null;
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  return children.find((child) => child?.dom) as HTMLElement | Text | null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  parentDom.insertBefore(instance?.dom as Node, anchor);
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  if (!instance) return;

  // Fragment나 Component의 경우 여러 DOM 노드를 가질 수 있음
  if (instance.kind === NodeTypes.FRAGMENT || instance.kind === NodeTypes.COMPONENT) {
    // 자식 인스턴스들을 재귀적으로 제거
    if (instance.children) {
      instance.children.forEach((child) => {
        if (child && child.dom && parentDom.contains(child.dom as Node)) {
          // 자식의 DOM이 부모에 포함되어 있으면 제거
          parentDom.removeChild(child.dom as Node);
        }
      });
    }
    return;
  }

  // HOST나 TEXT의 경우 instance.dom을 제거하면 자식들도 함께 제거됨
  if (instance.dom && parentDom.contains(instance.dom as Node)) {
    parentDom.removeChild(instance.dom as Node);
  }
};
