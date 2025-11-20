import { deepEquals } from "../utils";
import { memo } from "./memo";
import type { FunctionComponent } from "../core";

/**
 * `deepEquals`를 사용하여 props를 깊게 비교하는 `memo` HOC입니다.
 */
export function deepMemo<P extends object>(Component: FunctionComponent<P>) {
  // 여기를 구현하세요.
  // memo HOC와 deepEquals 함수를 사용해야 합니다.

  const MemoizedComponent = memo(Component, deepEquals);

  return MemoizedComponent;
}
