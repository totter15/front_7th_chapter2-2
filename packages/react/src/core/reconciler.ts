import { context } from "./context";
import { Fragment, NodeType, NodeTypes, TEXT_ELEMENT, HookTypes } from "./constants";
import { Instance, VNode, EffectHook } from "./types";
import { getFirstDom, getFirstDomFromChildren, removeInstance, setDomProps, updateDomProps } from "./dom";
import { createChildPath } from "./elements";

/**
 * 인스턴스의 모든 DOM 노드를 재귀적으로 수집합니다.
 * Fragment나 컴포넌트의 경우 여러 DOM 노드를 가질 수 있습니다.
 */
const collectAllDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  if (!instance) return [];

  const nodes: (HTMLElement | Text)[] = [];

  // Fragment나 컴포넌트의 경우 자식들의 DOM 노드를 수집
  if (instance.kind === NodeTypes.FRAGMENT || instance.kind === NodeTypes.COMPONENT) {
    if (instance.children) {
      instance.children.forEach((child) => {
        nodes.push(...collectAllDomNodes(child));
      });
    }
  } else if (instance.dom) {
    // HOST나 TEXT의 경우 dom 속성 사용
    nodes.push(instance.dom as HTMLElement | Text);
  }

  return nodes;
};

/**
 * 인스턴스와 그 자식들의 cleanup 함수를 실행하고 hooks 상태를 정리합니다.
 * key가 변경되어 언마운트될 때 호출됩니다.
 */
const cleanupInstance = (instance: Instance): void => {
  // 인스턴스의 경로에 해당하는 hooks cleanup 실행
  const hooks = context.hooks.state.get(instance.path);
  if (hooks) {
    hooks.forEach((hook) => {
      if (hook && typeof hook === "object" && "kind" in hook && hook.kind === HookTypes.EFFECT) {
        const effectHook = hook as EffectHook;
        if (effectHook.cleanup) {
          effectHook.cleanup();
        }
      }
    });
    // hooks 상태 정리
    context.hooks.state.delete(instance.path);
    context.hooks.cursor.delete(instance.path);
  }

  // 자식 인스턴스들도 재귀적으로 cleanup
  if (instance.children) {
    instance.children.forEach((child) => {
      if (child) {
        cleanupInstance(child);
      }
    });
  }
};

/**
 * 자식 인스턴스들의 DOM 노드를 올바른 순서로 재배치합니다.
 * key 기반 재조정 후 DOM 노드의 순서를 업데이트합니다.
 */
const reorderDomNodes = (parentDom: HTMLElement, children: (Instance | null)[]): void => {
  // 모든 DOM 노드를 순서대로 수집 (재귀적으로)
  const domNodes: (HTMLElement | Text)[] = [];
  for (const child of children) {
    const childNodes = collectAllDomNodes(child);
    domNodes.push(...childNodes);
  }

  // 각 DOM 노드를 올바른 위치로 이동
  // 역순으로 처리하여 앞쪽 노드 이동이 뒤쪽 노드에 영향을 주지 않도록 함
  for (let i = domNodes.length - 1; i >= 0; i--) {
    const currentDom = domNodes[i];
    if (!currentDom || !currentDom.parentNode) continue;

    const expectedNextSibling = i < domNodes.length - 1 ? domNodes[i + 1] : null;
    const actualNextSibling = currentDom.nextSibling;

    // 다음 형제가 올바르지 않으면 재배치
    if (actualNextSibling !== expectedNextSibling) {
      parentDom.insertBefore(currentDom, expectedNextSibling as Node | null);
    }
  }
};

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  context.hooks.componentStack.push(path);

  try {
    // 1. 새 노드가 null이면 기존 인스턴스를 제거합니다. (unmount)
    if (node === null) {
      if (instance) {
        // 언마운트되는 컴포넌트는 visited에 포함하지 않아야 cleanupUnusedHooks가 정리할 수 있음
        // cleanup 실행 및 DOM 제거
        cleanupInstance(instance);
        removeInstance(parentDom, instance);
      }

      return null;
    }

    // 이번 렌더링에서 방문한 경로 기록 (cleanup용)
    // node가 null이 아닐 때만 visited에 추가
    context.hooks.visited.add(path);

    // 노드 타입에 따라 kind 결정
    const getNodeKind = (vNode: VNode): NodeType => {
      if (vNode.type === TEXT_ELEMENT) return NodeTypes.TEXT;
      if (vNode.type === Fragment) return NodeTypes.FRAGMENT;
      if (typeof vNode.type === "function") return NodeTypes.COMPONENT;
      return NodeTypes.HOST;
    };

    // 2. 기존 인스턴스가 없으면 새 노드를 마운트합니다. (mount)
    if (instance === null) {
      const kind = getNodeKind(node);

      // 컴포넌트인 경우 함수 실행
      if (kind === NodeTypes.COMPONENT && typeof node.type === "function") {
        const renderedVNode = node.type(node.props);
        if (renderedVNode === null) return null;

        // 렌더된 VNode를 재조정
        const childPath = createChildPath(path, null, 0, renderedVNode.type);
        const childInstance = reconcile(parentDom, null, renderedVNode, childPath);

        return {
          kind,
          dom: getFirstDom(childInstance),
          node,
          children: childInstance ? [childInstance] : [],
          key: node.key,
          path,
        };
      }

      // 텍스트 노드
      if (kind === NodeTypes.TEXT) {
        const dom = document.createTextNode(node.props.nodeValue as string);
        parentDom.appendChild(dom);

        return {
          kind,
          dom,
          node,
          children: [],
          key: node.key,
          path,
        };
      }

      // Fragment
      if (kind === NodeTypes.FRAGMENT) {
        const childInstances: (Instance | null)[] = [];
        const children = node.props.children || [];

        children.forEach((child, index) => {
          const childPath = createChildPath(path, child.key, index, child.type, children);
          const childInstance = reconcile(parentDom, null, child, childPath);
          childInstances.push(childInstance);
        });

        return {
          kind,
          dom: getFirstDomFromChildren(childInstances),
          node,
          children: childInstances,
          key: node.key,
          path,
        };
      }

      // HTML 요소 (HOST)
      const dom = document.createElement(node.type as string);
      setDomProps(dom, node.props);
      parentDom.appendChild(dom);

      const newInstance: Instance = {
        kind,
        dom,
        node,
        children: [],
        key: node.key,
        path,
      };

      // 자식들을 재귀적으로 마운트
      const children = node.props.children || [];
      const childInstances: (Instance | null)[] = [];

      children.forEach((child, index) => {
        const childPath = createChildPath(path, child.key, index, child.type, children);
        const childInstance = reconcile(dom, null, child, childPath);
        childInstances.push(childInstance);
      });

      newInstance.children = childInstances;
      return newInstance;
    }

    // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
    if (instance.node.type !== node.type || instance.key !== node.key) {
      // cleanup 실행 (key 변경 시 이전 인스턴스의 cleanup 필요)
      cleanupInstance(instance);
      removeInstance(parentDom, instance);
      // 새로 마운트
      return reconcile(parentDom, null, node, path);
    }

    // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
    // DOM 요소: updateDomProps로 속성 업데이트 후 자식 재조정
    if (instance.kind === NodeTypes.HOST || instance.kind === NodeTypes.TEXT) {
      if (instance.dom) {
        updateDomProps(instance.dom as HTMLElement, instance.node.props, node.props);

        // 텍스트 노드 업데이트
        if (instance.kind === NodeTypes.TEXT && node.props.nodeValue !== undefined) {
          (instance.dom as Text).nodeValue = String(node.props.nodeValue);
        }
      }

      // 자식 재조정
      const oldChildren = instance.children || [];
      const newChildren = node.props.children || [];
      const updatedChildren: (Instance | null)[] = [];
      const usedOldIndices = new Set<number>();

      // 새로운 자식들을 순회하며 매칭
      newChildren.forEach((newChild, newIndex) => {
        if (!newChild) {
          updatedChildren.push(null);
          return;
        }

        let matchedOldChild: Instance | null = null;

        // key가 있으면 key로 매칭
        if (newChild.key !== null) {
          for (let i = 0; i < oldChildren.length; i++) {
            if (usedOldIndices.has(i)) continue;
            const oldChild = oldChildren[i];
            if (oldChild && oldChild.node.key === newChild.key) {
              matchedOldChild = oldChild;
              usedOldIndices.add(i);
              break;
            }
          }
        } else {
          // key가 없으면 타입 기반 매칭
          // 먼저 같은 인덱스에서 타입이 같은지 확인
          if (newIndex < oldChildren.length) {
            const oldChild = oldChildren[newIndex];
            if (oldChild && oldChild.node.type === newChild.type) {
              matchedOldChild = oldChild;
              usedOldIndices.add(newIndex);
            }
          }

          // 같은 인덱스에서 매칭되지 않으면 다른 위치에서 같은 타입 찾기
          if (!matchedOldChild) {
            for (let i = 0; i < oldChildren.length; i++) {
              if (usedOldIndices.has(i)) continue;
              const oldChild = oldChildren[i];
              if (oldChild && oldChild.node.type === newChild.type && oldChild.node.key === null) {
                matchedOldChild = oldChild;
                usedOldIndices.add(i);
                break;
              }
            }
          }
        }

        // 경로 생성: 매칭된 인스턴스가 있고 타입이 같으면 기존 경로 유지, 없으면 새 경로 생성
        const childPath =
          matchedOldChild && matchedOldChild.node.type === newChild.type
            ? matchedOldChild.path
            : createChildPath(path, newChild.key, newIndex, newChild.type, newChildren);

        // 타입이 다르거나 key가 다르면 기존 인스턴스를 null로 처리하여 새로 마운트
        const oldChildForReconcile =
          matchedOldChild && matchedOldChild.node.type === newChild.type ? matchedOldChild : null;

        // key가 다른 경우 이전 인스턴스 cleanup 및 DOM 제거
        // newChild.key가 있고, matchedOldChild가 없거나 key가 다른 경우
        if (newChild.key !== null && (!matchedOldChild || matchedOldChild.node.key !== newChild.key)) {
          // 이전 자식 중 같은 타입이지만 key가 다른 인스턴스 찾기
          for (let i = 0; i < oldChildren.length; i++) {
            if (usedOldIndices.has(i)) continue;
            const oldChild = oldChildren[i];
            if (
              oldChild &&
              oldChild.node.type === newChild.type &&
              oldChild.node.key !== newChild.key &&
              oldChild.node.key !== null
            ) {
              // 같은 타입이지만 key가 다른 경우 cleanup 및 DOM 제거
              cleanupInstance(oldChild);
              removeInstance(instance.dom as HTMLElement, oldChild);
              usedOldIndices.add(i); // 처리했으므로 사용된 것으로 표시
              break;
            }
          }
        }

        const childInstance = reconcile(instance.dom as HTMLElement, oldChildForReconcile, newChild, childPath);
        updatedChildren.push(childInstance);
      });

      // 사용되지 않은 기존 자식들 언마운트
      for (let i = 0; i < oldChildren.length; i++) {
        if (!usedOldIndices.has(i) && oldChildren[i]) {
          reconcile(instance.dom as HTMLElement, oldChildren[i], null, oldChildren[i]!.path);
        }
      }

      // DOM 노드를 올바른 순서로 재배치
      reorderDomNodes(instance.dom as HTMLElement, updatedChildren);

      instance.children = updatedChildren;
      instance.node = node;
      return instance;
    }

    // 컴포넌트: 컴포넌트 함수 재실행 후 자식 재조정
    if (instance.kind === NodeTypes.COMPONENT && typeof node.type === "function") {
      // 컴포넌트 함수 재실행
      const renderedVNode = node.type(node.props);

      if (renderedVNode === null) {
        removeInstance(parentDom, instance);
        return null;
      }

      // 렌더된 VNode를 재조정
      const childPath = createChildPath(path, null, 0, renderedVNode.type);
      const childInstance = reconcile(parentDom, instance.children[0] || null, renderedVNode, childPath);

      instance.children = [childInstance];
      instance.node = node;
      instance.dom = getFirstDom(childInstance);
      return instance;
    }

    // Fragment: 자식만 재조정
    if (instance.kind === NodeTypes.FRAGMENT) {
      const oldChildren = instance.children || [];
      const newChildren = node.props.children || [];
      const updatedChildren: (Instance | null)[] = [];
      const usedOldIndices = new Set<number>();

      // 새로운 자식들을 순회하며 매칭
      newChildren.forEach((newChild, newIndex) => {
        if (!newChild) {
          updatedChildren.push(null);
          return;
        }

        let matchedOldChild: Instance | null = null;

        // key가 있으면 key로 매칭
        if (newChild.key !== null) {
          for (let i = 0; i < oldChildren.length; i++) {
            if (usedOldIndices.has(i)) continue;
            const oldChild = oldChildren[i];
            if (oldChild && oldChild.node.key === newChild.key) {
              matchedOldChild = oldChild;
              usedOldIndices.add(i);
              break;
            }
          }
        } else {
          // key가 없으면 타입 기반 매칭
          // 먼저 같은 인덱스에서 타입이 같은지 확인
          if (newIndex < oldChildren.length) {
            const oldChild = oldChildren[newIndex];
            if (oldChild && oldChild.node.type === newChild.type) {
              matchedOldChild = oldChild;
              usedOldIndices.add(newIndex);
            }
          }

          // 같은 인덱스에서 매칭되지 않으면 다른 위치에서 같은 타입 찾기
          if (!matchedOldChild) {
            for (let i = 0; i < oldChildren.length; i++) {
              if (usedOldIndices.has(i)) continue;
              const oldChild = oldChildren[i];
              if (oldChild && oldChild.node.type === newChild.type && oldChild.node.key === null) {
                matchedOldChild = oldChild;
                usedOldIndices.add(i);
                break;
              }
            }
          }
        }

        // 경로 생성: 매칭된 인스턴스가 있고 타입이 같으면 기존 경로 유지, 없으면 새 경로 생성
        const childPath =
          matchedOldChild && matchedOldChild.node.type === newChild.type
            ? matchedOldChild.path
            : createChildPath(path, newChild.key, newIndex, newChild.type, newChildren);

        // 타입이 다르면 기존 인스턴스를 null로 처리하여 새로 마운트
        const oldChildForReconcile =
          matchedOldChild && matchedOldChild.node.type === newChild.type ? matchedOldChild : null;

        const childInstance = reconcile(parentDom, oldChildForReconcile, newChild, childPath);
        updatedChildren.push(childInstance);
      });

      // 사용되지 않은 기존 자식들 언마운트
      for (let i = 0; i < oldChildren.length; i++) {
        if (!usedOldIndices.has(i) && oldChildren[i]) {
          reconcile(parentDom, oldChildren[i], null, oldChildren[i]!.path);
        }
      }

      // DOM 노드를 올바른 순서로 재배치
      reorderDomNodes(parentDom, updatedChildren);

      instance.children = updatedChildren;
      instance.node = node;
      instance.dom = getFirstDomFromChildren(updatedChildren);
      return instance;
    }

    return instance;
  } finally {
    context.hooks.componentStack.pop();
  }
};
