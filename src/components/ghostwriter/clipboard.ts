export async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    const previousFocus = document.activeElement;
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      if (previousFocus instanceof HTMLElement)
        previousFocus.focus({ preventScroll: true });
    }
    if (!copied)
      throw new Error("Copy failed. Select the rewrite and copy it manually.");
  }
}
