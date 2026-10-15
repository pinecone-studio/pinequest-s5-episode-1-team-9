const KEY = "linguamatch:activeRoom";

export function rememberRoom(roomId: string) {
  try {
    window.sessionStorage.setItem(KEY, roomId);
  } catch {
    return;
  }
}

export function forgetRoom() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
}

export function recallRoom(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
