/**
 * 두 값의 얕은 동등성을 비교합니다.
 * 객체와 배열은 1단계 깊이까지만 비교합니다.
 */
export const shallowEquals = (a: unknown, b: unknown): boolean => {
  // 여기를 구현하세요.
  // Object.is(), Array.isArray(), Object.keys() 등을 활용하여 1단계 깊이의 비교를 구현합니다.
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  // 배열 비교
  if (typeof a === "object" && Array.isArray(a) && typeof b === "object" && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    if (a.some((value, index) => value !== b[index])) return false;
    return true;
  }

  //객체 비교
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    if (Object.keys(a).some((key) => a[key as keyof typeof a] !== b[key as keyof typeof b])) return false;
    return true;
  }

  // 함수 비교
  if (typeof a === "function" && typeof b === "function") return a.toString() === b.toString();
  return Object.is(a, b);
};

/**
 * 두 값의 깊은 동등성을 비교합니다.
 * 객체와 배열의 모든 중첩된 속성을 재귀적으로 비교합니다.
 */
export const deepEquals = (a: unknown, b: unknown): boolean => {
  // 여기를 구현하세요.
  // 재귀적으로 deepEquals를 호출하여 중첩된 구조를 비교해야 합니다.
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && Array.isArray(a) && typeof b === "object" && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    if (a.some((value, index) => !deepEquals(value, b[index]))) return false;
    return true;
  }

  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    if (Object.keys(a).some((key) => !deepEquals(a[key as keyof typeof a], b[key as keyof typeof b]))) return false;
    return true;
  }
  if (typeof a === "function" && typeof b === "function") return a.toString() === b.toString();
  return Object.is(a, b);
};
