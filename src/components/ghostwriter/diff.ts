export type DiffOp =
  | { kind: "equal"; text: string }
  | { kind: "delete"; text: string }
  | { kind: "insert"; text: string };

function tokenize(input: string): string[] {
  return input.match(/\s+|[\w'']+|[^\s\w]/g) ?? [];
}

export function diffWords(a: string, b: string): DiffOp[] {
  const source = tokenize(a);
  const target = tokenize(b);
  const sourceLength = source.length;
  const targetLength = target.length;

  const dp: number[][] = Array.from({ length: sourceLength + 1 }, () =>
    new Array(targetLength + 1).fill(0),
  );

  for (let sourceIndex = sourceLength - 1; sourceIndex >= 0; sourceIndex -= 1) {
    for (let targetIndex = targetLength - 1; targetIndex >= 0; targetIndex -= 1) {
      if (source[sourceIndex] === target[targetIndex]) {
        dp[sourceIndex][targetIndex] = dp[sourceIndex + 1][targetIndex + 1] + 1;
      } else {
        dp[sourceIndex][targetIndex] = Math.max(
          dp[sourceIndex + 1][targetIndex],
          dp[sourceIndex][targetIndex + 1],
        );
      }
    }
  }

  const ops: DiffOp[] = [];
  let sourceIndex = 0;
  let targetIndex = 0;

  const push = (op: DiffOp) => {
    const last = ops[ops.length - 1];

    if (last && last.kind === op.kind) {
      last.text += op.text;
      return;
    }

    ops.push(op);
  };

  while (sourceIndex < sourceLength && targetIndex < targetLength) {
    if (source[sourceIndex] === target[targetIndex]) {
      push({ kind: "equal", text: source[sourceIndex] });
      sourceIndex += 1;
      targetIndex += 1;
    } else if (dp[sourceIndex + 1][targetIndex] >= dp[sourceIndex][targetIndex + 1]) {
      push({ kind: "delete", text: source[sourceIndex] });
      sourceIndex += 1;
    } else {
      push({ kind: "insert", text: target[targetIndex] });
      targetIndex += 1;
    }
  }

  while (sourceIndex < sourceLength) {
    push({ kind: "delete", text: source[sourceIndex] });
    sourceIndex += 1;
  }

  while (targetIndex < targetLength) {
    push({ kind: "insert", text: target[targetIndex] });
    targetIndex += 1;
  }

  return ops;
}
