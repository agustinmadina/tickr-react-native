/**
 * A WebSocket, behind an interface so the feed logic can be tested without a
 * server.
 *
 * The Kotlin project gets this for free: Ktor's `webSocket` builder is a
 * suspend function, so a test swaps in `MockEngine` and the repository code is
 * unchanged. Here the global `WebSocket` is not injectable, so the seam has to
 * be explicit. It is the same idea, one level more manual.
 */

export interface SocketHandle {
  send(data: string): void;
  close(): void;
}

export interface SocketFactory {
  open(
    url: string,
    handlers: {
      onOpen: () => void;
      onMessage: (data: string) => void;
      onClose: () => void;
      onError: (error: unknown) => void;
    },
  ): SocketHandle;
}

/**
 * The real one. `WebSocket` is a global in React Native and in the browser, and
 * it is the same API in both, so there is no per-platform file here.
 */
export const createSocket: SocketFactory = {
  open(url, handlers) {
    const socket = new WebSocket(url);

    socket.onopen = () => handlers.onOpen();
    socket.onmessage = (event: MessageEvent) => {
      // A binary frame would arrive as a Blob or ArrayBuffer. The Coinbase feed
      // is text-only, so anything else is dropped rather than coerced.
      if (typeof event.data === 'string') handlers.onMessage(event.data);
    };
    socket.onclose = () => handlers.onClose();
    socket.onerror = (event: Event) => handlers.onError(event);

    return {
      send: (data) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data);
      },
      close: () => {
        // Null the handlers first. Closing a socket that is already closing
        // fires onclose again, and the reconnect loop would treat that as a
        // fresh disconnect and schedule a second reconnect.
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      },
    };
  },
};
