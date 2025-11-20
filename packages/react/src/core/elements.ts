/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null => {
  if (typeof node === "string" || typeof node === "number") return createTextElement(node);
  if (typeof node === "object" && node !== null) return node;
  return null;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (node: string | number): VNode => {
  return { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: node.toString() } } as VNode;
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  const { key, ...resetProps } = originProps || {};
  const children = rawChildren.flat(Infinity).map(normalizeNode).filter(isEmptyValue);
  const isChildren = children.length > 0;

  return {
    type,
    key: key || null,
    props: {
      ...resetProps,
      ...(isChildren ? { children } : {}),
    },
  };
};

/**
 * 타입을 문자열로 변환합니다.
 */
const getTypeString = (type: string | symbol | React.ComponentType | undefined): string => {
  if (!type) return "unknown";
  if (typeof type === "string") return type;
  if (typeof type === "symbol") return type.toString();
  if (typeof type === "function") {
    return (type as any).name || (type as any).displayName || "Anonymous";
  }
  return String(type);
};

/**
 * 부모 경로와 자식의 key/index/type을 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 * key가 없을 때는 타입 정보를 포함하여 같은 타입의 컴포넌트가 항상 같은 경로를 유지하도록 합니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  // key가 있으면 key 기반 경로
  if (key !== null) {
    return `${parentPath}.k${key}`;
  }

  // key가 없으면 타입 정보를 포함한 경로 생성
  // 같은 타입의 컴포넌트는 같은 타입 식별자를 가지므로 경로가 유지됨
  const typeStr = getTypeString(nodeType);
  // 타입 이름에서 특수문자 제거 (경로에 사용 가능한 문자만 사용)
  const sanitizedType = typeStr.replace(/[^a-zA-Z0-9_$]/g, "_");

  return `${parentPath}.c${index}.t${sanitizedType}`;
};
